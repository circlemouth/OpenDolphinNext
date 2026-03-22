package open.dolphin.msg;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.StringWriter;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.text.NumberFormat;
import java.util.Properties;
import java.util.logging.Level;
import java.util.logging.Logger;
import jakarta.mail.Message.RecipientType;
import jakarta.mail.MessagingException;
import jakarta.mail.PasswordAuthentication;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import open.dolphin.infomodel.ActivityModel;
import open.dolphin.msg.dto.AccountSummaryMessage;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import org.apache.velocity.VelocityContext;
import org.apache.velocity.app.Velocity;
import org.apache.velocity.exception.MethodInvocationException;
import org.apache.velocity.exception.ParseErrorException;
import org.apache.velocity.exception.ResourceNotFoundException;

public class OidSender {

    private static final Logger LOGGER = Logger.getLogger("open.dolphin");

    private static final String MAIL_ENC = "ISO-2022-JP";
    private static final String ACTIVITY_RESULT = "【使用量レポート】";
    private static final String ACCOUNT_MAKING_RESULT = "OpenDolphinアカウント作成のお知らせ";
    private static final String MEMBER_TEMPLATE = "member-mail.vm";
    private static final String TESTER_TEMPLATE = "account-mail.vm";
    private static final String TEMPLATE_ENC = "SHIFT_JIS";
    private static final String OBJECT_NAME = "account";
    private static final DateTimeFormatter TARGET_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy'年'MM'月'dd'日'");
    private static final DateTimeFormatter REPORT_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy'年'MM'月'");
    private static final String ASP_TESTER = "ASP_TESTER";
    private static final String ASP_MEMBER = "ASP_MEMBER";

    private final ServerConfigurationResolver configurationResolver;

    public OidSender() {
        this(new ServerConfigurationResolver());
    }

    OidSender(ServerConfigurationResolver configurationResolver) {
        this.configurationResolver = configurationResolver;
    }

    public void send(AccountSummaryMessage account) {
        if (account == null || account.getUserEmail() == null || account.getUserEmail().isBlank()) {
            LOGGER.warning("SMTP account mail skipped: user email is missing.");
            return;
        }

        ResolvedSmtpSettings smtp = resolveSmtpSettings();
        if (smtp == null) {
            return;
        }

        try {
            String body = renderAccountMail(account);
            Session session = createSession(smtp);
            jakarta.mail.internet.MimeMessage mimeMessage = new jakarta.mail.internet.MimeMessage(session);
            mimeMessage.setFrom(new InternetAddress(smtp.fromAddress()));
            mimeMessage.setRecipients(jakarta.mail.Message.RecipientType.TO, InternetAddress.parse(account.getUserEmail()));
            if (smtp.bccAddress() != null) {
                mimeMessage.addRecipients(RecipientType.BCC, InternetAddress.parse(smtp.bccAddress()));
            }
            mimeMessage.setSubject(ACCOUNT_MAKING_RESULT, MAIL_ENC);
            mimeMessage.setText(body, MAIL_ENC);
            Transport.send(mimeMessage);
        } catch (IOException | ResourceNotFoundException | ParseErrorException
                | MethodInvocationException | MessagingException ex) {
            LOGGER.log(Level.WARNING, "Failed to send account summary email", ex);
        }
    }

    public void sendActivity(ActivityModel[] ams) {
        if (ams == null || ams.length < 2 || ams[0] == null || ams[1] == null) {
            LOGGER.warning("SMTP activity mail skipped: activity payload is invalid.");
            return;
        }
        ResolvedSmtpSettings smtp = resolveSmtpSettings();
        if (smtp == null) {
            return;
        }
        String activityTo = resolveActivityRecipient();
        if (activityTo == null) {
            LOGGER.warning("SMTP activity mail skipped: recipient is not configured.");
            return;
        }

        ActivityModel am = ams[0];
        ActivityModel total = ams[1];

        try {
            String body = buildActivityBody(am, total);
            Session session = createSession(smtp);
            jakarta.mail.internet.MimeMessage mimeMessage = new jakarta.mail.internet.MimeMessage(session);
            mimeMessage.setFrom(new InternetAddress(smtp.fromAddress()));
            mimeMessage.setRecipients(jakarta.mail.Message.RecipientType.TO, InternetAddress.parse(activityTo));
            if (smtp.bccAddress() != null) {
                mimeMessage.addRecipients(RecipientType.BCC, InternetAddress.parse(smtp.bccAddress()));
            }
            String subject = ACTIVITY_RESULT + reportDateFromDate(am.getFromLocalDate()) + "-" + total.getFacilityName();
            mimeMessage.setSubject(subject, MAIL_ENC);
            mimeMessage.setText(body, MAIL_ENC);
            Transport.send(mimeMessage);
        } catch (MessagingException ex) {
            LOGGER.log(Level.WARNING, "Failed to send activity email", ex);
        }
    }

    private String renderAccountMail(AccountSummaryMessage account) throws IOException {
        VelocityContext context = VelocityHelper.getContext();
        context.put(OBJECT_NAME, account);
        StringWriter writer = new StringWriter();
        try (BufferedWriter bufferedWriter = new BufferedWriter(writer)) {
            String memberType = account.getMemberType();
            if (ASP_TESTER.equals(memberType)) {
                Velocity.mergeTemplate(TESTER_TEMPLATE, TEMPLATE_ENC, context, bufferedWriter);
            } else if (ASP_MEMBER.equals(memberType)) {
                Velocity.mergeTemplate(MEMBER_TEMPLATE, TEMPLATE_ENC, context, bufferedWriter);
            } else {
                LOGGER.warning("Unsupported memberType for AccountSummary: " + memberType);
            }
            bufferedWriter.flush();
        }
        return writer.toString();
    }

    private String buildActivityBody(ActivityModel am, ActivityModel total) {
        StringBuilder sb = new StringBuilder();
        sb.append("集計期間=").append(targetDateFromDate(am.getFromLocalDate())).append("~").append(targetDateFromDate(am.getToLocalDate())).append("\n");
        sb.append("------------------------------------").append("\n");
        sb.append("医療機関ID=").append(total.getFacilityId()).append("\n");
        sb.append("医療機関名=").append(total.getFacilityName()).append("\n");
        sb.append("郵便番号=").append(total.getFacilityZip()).append("\n");
        sb.append("住所=").append(total.getFacilityAddress()).append("\n");
        sb.append("電話=").append(total.getFacilityTelephone()).append("\n");
        sb.append("FAX=").append(total.getFacilityFacimile()).append("\n");
        sb.append("利用者数=").append(total.getNumOfUsers()).append("\n");
        sb.append("************************************").append("\n");
        sb.append("患者登録数= ").append(formatNumber(am.getNumOfPatients())).append(" / ").append(formatNumber(total.getNumOfPatients())).append("\n");
        sb.append("来院数= ").append(formatNumber(am.getNumOfPatientVisits())).append(" / ").append(formatNumber(total.getNumOfPatientVisits())).append("\n");
        sb.append("病名数= ").append(formatNumber(am.getNumOfDiagnosis())).append(" / ").append(formatNumber(total.getNumOfDiagnosis())).append("\n");
        sb.append("カルテ枚数= ").append(formatNumber(am.getNumOfKarte())).append(" / ").append(formatNumber(total.getNumOfKarte())).append("\n");
        sb.append("画像数= ").append(formatNumber(am.getNumOfImages())).append(" / ").append(formatNumber(total.getNumOfImages())).append("\n");
        sb.append("添付文書数= ").append(formatNumber(am.getNumOfAttachments())).append(" / ").append(formatNumber(total.getNumOfAttachments())).append("\n");
        sb.append("紹介状数= ").append(formatNumber(am.getNumOfLetters())).append(" / ").append(formatNumber(total.getNumOfLetters())).append("\n");
        sb.append("検査数= ").append(formatNumber(am.getNumOfLabTests())).append(" / ").append(formatNumber(total.getNumOfLabTests())).append("\n");
        sb.append("************************************").append("\n");
        sb.append("データベース容量= ").append(total.getDbSize()).append("\n");
        sb.append("IPアドレス= ").append(total.getBindAddress()).append("\n");
        sb.append("\n");
        sb.append("*** 集計期間数/総数 を表示").append("\n");
        return sb.toString();
    }

    private Session createSession(ResolvedSmtpSettings settings) {
        if (settings.authRequired()) {
            return Session.getDefaultInstance(settings.properties(), new jakarta.mail.Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(settings.username(), settings.password());
                }
            });
        }
        return Session.getDefaultInstance(settings.properties());
    }

    ResolvedSmtpSettings resolveSmtpSettings() {
        ServerRuntimeConfiguration.SmtpSettings configured = configurationResolver.smtp();
        String host = configured.host();
        String port = firstNonBlank(configured.port(), "25");
        String from = configured.from();
        String username = configured.username();
        String password = configured.password();
        String bcc = configured.bcc();

        if (host == null || from == null) {
            LOGGER.warning("SMTP send skipped: required SMTP host/from is not configured.");
            return null;
        }

        boolean authRequired = Boolean.TRUE.equals(configured.auth()) || (username != null && password != null);
        if (authRequired && (username == null || password == null)) {
            LOGGER.warning("SMTP send skipped: authentication is enabled but username/password are missing.");
            return null;
        }

        Properties props = new Properties();
        props.put("mail.smtp.host", host);
        props.put("mail.smtp.port", port);
        props.put("mail.smtp.auth", Boolean.toString(authRequired));
        if (Boolean.TRUE.equals(configured.startTls())) {
            props.put("mail.smtp.starttls.enable", "true");
        }

        return new ResolvedSmtpSettings(props, authRequired, username, password, from, bcc);
    }

    String resolveActivityRecipient() {
        ServerRuntimeConfiguration.SmtpSettings configured = configurationResolver.smtp();
        String value = configured.activityTo();
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String targetDateFromDate(LocalDate date) {
        return date == null ? "" : TARGET_DATE_FORMATTER.format(date);
    }

    private String reportDateFromDate(LocalDate date) {
        return date == null ? "" : REPORT_DATE_FORMATTER.format(date);
    }

    private String formatNumber(long num) {
        NumberFormat nf = NumberFormat.getNumberInstance();
        return nf.format(num);
    }

    record ResolvedSmtpSettings(
            Properties properties,
            boolean authRequired,
            String username,
            String password,
            String fromAddress,
            String bccAddress
    ) {
    }
}
