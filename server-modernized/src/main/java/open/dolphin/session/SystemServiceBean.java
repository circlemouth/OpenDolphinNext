package open.dolphin.session;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Calendar;
import java.util.Collection;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.ObjLongConsumer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import jakarta.persistence.EntityExistsException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import open.dolphin.infomodel.*;
import open.dolphin.msg.OidSender;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.session.framework.SessionOperation;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
//import org.jboss.ejb3.annotation.ResourceAdapter;

/**
 *
 * @author kazushi, Minagawa, Digital Globe, Inc.
 */
@Named
@ApplicationScoped
@Transactional
@SessionOperation
//s.oh^ 2014/02/21 Claim送信方法の変更
//@ResourceAdapter("hornetq-ra.rar")
//s.oh$
public class SystemServiceBean {

    private static final Logger LOGGER = LoggerFactory.getLogger(SystemServiceBean.class);

    //private static final boolean DolphinPro = true;

    //private static final String BASE_OID = "1.3.6.1.4.1.9414.3.";               // 3.xx

    private static final String BASE_OID = "1.3.6.1.4.1.9414.72.";

    private static final String QUERY_NEXT_FID = "select nextval('facility_num') as n";
    private static final String QUERY_FACILITY_BY_FID = "from FacilityModel f where f.facilityId=:fid";
    private static final String FID = "fid";

    private static final String ASP_TESTER = "ASP_TESTER";

    @PersistenceContext
    private EntityManager em;

    @jakarta.inject.Inject
    private ServerConfigurationResolver configurationResolver;
    
//s.oh^ 2014/02/21 Claim送信方法の変更
    //@Resource(mappedName = "java:/JmsXA")
    //private ConnectionFactory connectionFactory;
    //
    //@Resource(mappedName = "java:/queue/dolphin")
    //private jakarta.jms.Queue queue;
//s.oh$
    

    /**
     * 施設と管理者情報を登録する。
     *
     * @param user 施設管理者
     */
    public AccountSummary addFacilityAdmin(UserModel user) {
        String fid = allocateFacilityId();
        persistFacility(user, fid);
        persistUserWithRoles(user, fid);
        return buildAccountSummary(user);
    }
    
//s.oh^ 2014/07/08 クラウド0対応
    /**
     * カルテ枚数等、全件数をカウントする
     * @param fid  医療機関 OID
     * @return 
     */
    public ActivityModel countTotalActivities(String fid) {
        FacilityModel facility = findFacilityModel(fid);
        return countTotalActivitiesBulk(List.of(facility)).get(fid);
    }
    
    /**
     * 対象期間のレコード件数をカウントする
     * @param fid   医療機関OID
     * @param from  集計開始日
     * @param to    集計終了日
     * @return 
     */
    public ActivityModel countActivities(String fid, Date from, Date to) {
        return countActivities(fid, toLocalDate(from), toLocalDate(to));
    }

    public ActivityModel countActivities(String fid, LocalDate from, LocalDate to) {
        FacilityModel facility = findFacilityModel(fid);
        return countMonthlyActivitiesBulk(List.of(facility), from, to).get(fid);
    }
    
    public void mailActivities(ActivityModel[] ams) {
        mailActivities(ams, new OidSender());
    }

    public void mailActivities(ActivityModel[] ams, OidSender sender) {
        
        ActivityModel am = ams[0];
        ActivityModel total = ams[1];
        
        // log
        log("開始日時", String.valueOf(am.getFromLocalDate()));
        log("終了日時", String.valueOf(am.getToLocalDate()));
        log("医療機関ID", total.getFacilityId());
        log("医療機関名", total.getFacilityName());
        log("郵便番号", total.getFacilityZip());
        log("住所", total.getFacilityAddress());
        log("電話", total.getFacilityTelephone());
        log("FAX", total.getFacilityFacimile());
        log("利用者数", am.getNumOfUsers());
        log("患者数", am.getNumOfPatients(), total.getNumOfPatients());
        log("来院数", am.getNumOfPatientVisits(),total.getNumOfPatientVisits());
        log("病名数", am.getNumOfDiagnosis(),total.getNumOfDiagnosis());
        log("カルテ枚数", am.getNumOfKarte(),total.getNumOfKarte());
        log("画像数", am.getNumOfImages(),total.getNumOfImages());
        log("添付文書数", am.getNumOfAttachments(),total.getNumOfAttachments());
        log("紹介状数", am.getNumOfLetters(),total.getNumOfLetters());
        log("検査数", am.getNumOfLabTests(),total.getNumOfLabTests());
        log("データベース容量", total.getDbSize());
        log("IP アドレス", total.getBindAddress());
        
        // MailでOIDを通知するためMessageDrivenBeanに渡す
        //Connection conn = null;
        //try {
        //    conn = connectionFactory.createConnection();
        //    Session session = conn.createSession(false, QueueSession.AUTO_ACKNOWLEDGE);
        //    ObjectMessage msg = session.createObjectMessage(ams);
        //    MessageProducer producer = session.createProducer(queue);
        //    producer.send(msg);
        //
        //} catch (JMSException e) {
        //    e.printStackTrace(System.err);
        //    throw new RuntimeException(e.getMessage());
        //
        //} 
        //finally {
        //    if(conn != null)
        //    {
        //        try
        //        {
        //        conn.close();
        //        }
        //        catch (JMSException e)
        //        { 
        //        }
        //    }
        //}
        LOGGER.info("ActivityModel message has received. Reporting will start(Not Que).");
        try {
            sender.sendActivity(ams);
        } catch (Exception ex) {
            ex.printStackTrace(System.err);
            LOGGER.warn("ActivityModel message send error : {}", ex.getMessage());
        }
    }

    Map<String, ActivityModel> countTotalActivitiesBulk(List<FacilityModel> facilities) {
        Map<String, ActivityModel> activities = initializeActivities(facilities);
        if (activities.isEmpty()) {
            return activities;
        }

        applyGroupedCount(
                "select substring(u.userId, 1, locate(':', u.userId) - 1), count(u.id) "
                        + "from UserModel u where u.memberType!=:memberType "
                        + "group by substring(u.userId, 1, locate(':', u.userId) - 1)",
                activities,
                ActivityModel::setNumOfUsers,
                query -> query.setParameter("memberType", "EXPIRED"));
        applyGroupedCount(
                "select p.facilityId, count(p.id) from PatientModel p group by p.facilityId",
                activities,
                ActivityModel::setNumOfPatients);
        applyGroupedCount(
                "select p.facilityId, count(p.id) from PatientVisitModel p where p.status!=:status group by p.facilityId",
                activities,
                ActivityModel::setNumOfPatientVisits,
                query -> query.setParameter("status", 6));
        applyGroupedCount(
                "select substring(d.creator.userId, 1, locate(':', d.creator.userId) - 1), count(d.id) "
                        + "from DocumentModel d where d.status='F' "
                        + "group by substring(d.creator.userId, 1, locate(':', d.creator.userId) - 1)",
                activities,
                ActivityModel::setNumOfKarte);
        applyGroupedCount(
                "select substring(s.creator.userId, 1, locate(':', s.creator.userId) - 1), count(s.id) "
                        + "from SchemaModel s where s.status='F' "
                        + "group by substring(s.creator.userId, 1, locate(':', s.creator.userId) - 1)",
                activities,
                ActivityModel::setNumOfImages);
        applyGroupedCount(
                "select substring(a.creator.userId, 1, locate(':', a.creator.userId) - 1), count(a.id) "
                        + "from AttachmentModel a where a.status='F' "
                        + "group by substring(a.creator.userId, 1, locate(':', a.creator.userId) - 1)",
                activities,
                ActivityModel::setNumOfAttachments);
        applyGroupedCount(
                "select substring(r.creator.userId, 1, locate(':', r.creator.userId) - 1), count(r.id) "
                        + "from RegisteredDiagnosisModel r "
                        + "group by substring(r.creator.userId, 1, locate(':', r.creator.userId) - 1)",
                activities,
                ActivityModel::setNumOfDiagnosis);
        applyGroupedCount(
                "select substring(l.creator.userId, 1, locate(':', l.creator.userId) - 1), count(l.id) "
                        + "from LetterModule l where l.status='F' "
                        + "group by substring(l.creator.userId, 1, locate(':', l.creator.userId) - 1)",
                activities,
                ActivityModel::setNumOfLetters);
        applyGroupedCount(
                "select substring(l.patientId, 1, locate(':', l.patientId) - 1), count(l.id) "
                        + "from NLaboModule l "
                        + "group by substring(l.patientId, 1, locate(':', l.patientId) - 1)",
                activities,
                ActivityModel::setNumOfLabTests);

        String dbSize = em.createNativeQuery("select pg_size_pretty(pg_database_size('dolphin'))")
                .getSingleResult()
                .toString();
        String bindAddress = getBindAddress();
        for (ActivityModel activity : activities.values()) {
            activity.setDbSize(dbSize);
            activity.setBindAddress(bindAddress);
        }
        return activities;
    }

    Map<String, ActivityModel> countMonthlyActivitiesBulk(List<FacilityModel> facilities, Date from, Date to) {
        return countMonthlyActivitiesBulk(facilities, from, to, toLocalDate(from), toLocalDate(to));
    }

    Map<String, ActivityModel> countMonthlyActivitiesBulk(List<FacilityModel> facilities, LocalDate from, LocalDate to) {
        return countMonthlyActivitiesBulk(facilities, toDateAtStartOfDay(from), toDateAtEndOfDay(to), from, to);
    }

    private Map<String, ActivityModel> countMonthlyActivitiesBulk(
            List<FacilityModel> facilities,
            Date fromDate,
            Date toDate,
            LocalDate fromLocalDate,
            LocalDate toLocalDate
    ) {
        Map<String, ActivityModel> activities = initializeActivities(facilities);
        if (activities.isEmpty()) {
            return activities;
        }

        for (ActivityModel activity : activities.values()) {
            activity.setFromLocalDate(fromLocalDate);
            activity.setToLocalDate(toLocalDate);
        }

        applyMonthlyPatientCounts(activities, fromDate, toDate);
        applyMonthlyVisitCounts(activities, fromDate, toDate);
        applyMonthlyDocumentCounts(activities, fromDate, toDate);
        applyMonthlyImageCounts(activities, fromDate, toDate);
        applyMonthlyAttachmentCounts(activities, fromDate, toDate);
        applyMonthlyDiagnosisCounts(activities, fromDate, toDate);
        applyMonthlyLetterCounts(activities, fromDate, toDate);
        applyMonthlyLabCounts(activities, fromLocalDate, toLocalDate);

        return activities;
    }
    
    public void sendMonthlyActivities(int year, int month) {
        
        // 対象月の１日
        GregorianCalendar gcFrom = new GregorianCalendar(year, month, 1);
        LocalDate fromDate = gcFrom.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        
        // 対象月の最後
        GregorianCalendar gcTo = new GregorianCalendar(year, month, gcFrom.getActualMaximum(Calendar.DAY_OF_MONTH), 23, 59, 59);
        LocalDate toDate = gcTo.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        
        List<FacilityModel> list = loadFacilities();
        Map<String, ActivityModel> totalActivities = countTotalActivitiesBulk(list);
        Map<String, ActivityModel> monthlyActivities = countMonthlyActivitiesBulk(list, fromDate, toDate);
        OidSender sender = new OidSender();
        for (FacilityModel fm : list) {
            ActivityModel total = totalActivities.get(fm.getFacilityId());
            if (total == null) {
                continue;
            }
            total.setFlag("T");

            ActivityModel target = monthlyActivities.get(fm.getFacilityId());
            if (target == null) {
                continue;
            }
            target.setFlag("M");

            this.mailActivities(new ActivityModel[]{target, total}, sender);
        }
    }
    
    private Map<String, ActivityModel> initializeActivities(List<FacilityModel> facilities) {
        Map<String, ActivityModel> activities = new LinkedHashMap<>();
        for (FacilityModel facility : facilities) {
            ActivityModel activity = new ActivityModel();
            activity.setFacilityId(facility.getFacilityId());
            activity.setFacilityName(facility.getFacilityName());
            activity.setFacilityZip(facility.getZipCode());
            activity.setFacilityAddress(facility.getAddress());
            activity.setFacilityTelephone(facility.getTelephone());
            activity.setFacilityFacimile(facility.getFacsimile());
            activities.put(facility.getFacilityId(), activity);
        }
        return activities;
    }

    private String allocateFacilityId() {
        Number nextId = (Number) em.createNativeQuery(QUERY_NEXT_FID).getSingleResult();
        Long nextFnum = Long.valueOf(nextId.longValue());
        return new StringBuilder(BASE_OID).append(nextFnum).toString();
    }

    private void persistFacility(UserModel user, String fid) {
        FacilityModel facility = user.getFacilityModel();
        facility.setFacilityId(fid);
        try {
            em.createQuery(QUERY_FACILITY_BY_FID)
                    .setParameter(FID, fid)
                    .getSingleResult();
            throw new EntityExistsException();
        } catch (NoResultException e) {
            // expected
        }
        em.persist(facility);
    }

    private void persistUserWithRoles(UserModel user, String fid) {
        String originalUserId = user.getUserId();
        user.setUserId(fid + IInfoModel.COMPOSITE_KEY_MAKER + originalUserId);
        List<RoleModel> roles = user.getRoles();
        user.setRoles(null);
        em.persist(user);
        em.flush();
        if (roles == null) {
            return;
        }
        user.setRoles(roles);
        for (RoleModel role : roles) {
            role.setUserModel(user);
            role.setUserId(user.getUserId());
            em.persist(role);
        }
    }

    private AccountSummary buildAccountSummary(UserModel user) {
        AccountSummary account = new AccountSummary();
        account.setMemberType(ASP_TESTER);
        account.setFacilityAddress(user.getFacilityModel().getAddress());
        account.setFacilityId(user.getFacilityModel().getFacilityId());
        account.setFacilityName(user.getFacilityModel().getFacilityName());
        account.setFacilityTelephone(user.getFacilityModel().getTelephone());
        account.setFacilityZipCode(user.getFacilityModel().getZipCode());
        account.setUserEmail(user.getEmail());
        account.setUserName(user.getCommonName());
        account.setUserId(user.idAsLocal());
        return account;
    }

    private void applyGroupedCount(String jpql, Map<String, ActivityModel> activities, ObjLongConsumer<ActivityModel> setter) {
        applyGroupedCount(jpql, activities, setter, query -> {
        });
    }

    @SuppressWarnings("unchecked")
    private void applyGroupedCount(
            String jpql,
            Map<String, ActivityModel> activities,
            ObjLongConsumer<ActivityModel> setter,
            Consumer<Query> parameterizer
    ) {
        Query query = em.createQuery(jpql);
        parameterizer.accept(query);
        List<Object[]> rows = query.getResultList();
        for (Object[] row : rows) {
            String facilityId = (String) row[0];
            ActivityModel activity = activities.get(facilityId);
            if (activity != null) {
                setter.accept(activity, ((Number) row[1]).longValue());
            }
        }
    }

    private void applyMonthlyPatientCounts(Map<String, ActivityModel> activities, Date fromDate, Date toDate) {
        applyGroupedCount(
                "select p.facilityId, count(p.id) from PatientModel p, KarteBean k "
                        + "where p.id=k.patient.id and k.created between :fromDate and :toDate "
                        + "group by p.facilityId",
                activities,
                ActivityModel::setNumOfPatients,
                query -> {
                    query.setParameter("fromDate", fromDate);
                    query.setParameter("toDate", toDate);
                });
    }

    private void applyMonthlyVisitCounts(Map<String, ActivityModel> activities, Date fromDate, Date toDate) {
        applyGroupedCount(
                "select p.facilityId, count(p.id) from PatientVisitModel p "
                        + "where p.pvtDate between :fromDate and :toDate and p.status!=:status "
                        + "group by p.facilityId",
                activities,
                ActivityModel::setNumOfPatientVisits,
                query -> {
                    query.setParameter("fromDate", toLocalDateTime(fromDate));
                    query.setParameter("toDate", toLocalDateTime(toDate));
                    query.setParameter("status", 6);
                });
    }

    private void applyMonthlyDocumentCounts(Map<String, ActivityModel> activities, Date fromDate, Date toDate) {
        applyGroupedCount(
                "select substring(d.creator.userId, 1, locate(':', d.creator.userId) - 1), count(d.id) "
                        + "from DocumentModel d where d.started between :fromDate and :toDate and d.status='F' "
                        + "group by substring(d.creator.userId, 1, locate(':', d.creator.userId) - 1)",
                activities,
                ActivityModel::setNumOfKarte,
                query -> {
                    query.setParameter("fromDate", fromDate);
                    query.setParameter("toDate", toDate);
                });
    }

    private void applyMonthlyImageCounts(Map<String, ActivityModel> activities, Date fromDate, Date toDate) {
        applyGroupedCount(
                "select substring(s.creator.userId, 1, locate(':', s.creator.userId) - 1), count(s.id) "
                        + "from SchemaModel s where s.started between :fromDate and :toDate and s.status='F' "
                        + "group by substring(s.creator.userId, 1, locate(':', s.creator.userId) - 1)",
                activities,
                ActivityModel::setNumOfImages,
                query -> {
                    query.setParameter("fromDate", fromDate);
                    query.setParameter("toDate", toDate);
                });
    }

    private void applyMonthlyAttachmentCounts(Map<String, ActivityModel> activities, Date fromDate, Date toDate) {
        applyGroupedCount(
                "select substring(a.creator.userId, 1, locate(':', a.creator.userId) - 1), count(a.id) "
                        + "from AttachmentModel a where a.started between :fromDate and :toDate and a.status='F' "
                        + "group by substring(a.creator.userId, 1, locate(':', a.creator.userId) - 1)",
                activities,
                ActivityModel::setNumOfAttachments,
                query -> {
                    query.setParameter("fromDate", fromDate);
                    query.setParameter("toDate", toDate);
                });
    }

    private void applyMonthlyDiagnosisCounts(Map<String, ActivityModel> activities, Date fromDate, Date toDate) {
        applyGroupedCount(
                "select substring(r.creator.userId, 1, locate(':', r.creator.userId) - 1), count(r.id) "
                        + "from RegisteredDiagnosisModel r where r.started between :fromDate and :toDate "
                        + "group by substring(r.creator.userId, 1, locate(':', r.creator.userId) - 1)",
                activities,
                ActivityModel::setNumOfDiagnosis,
                query -> {
                    query.setParameter("fromDate", fromDate);
                    query.setParameter("toDate", toDate);
                });
    }

    private void applyMonthlyLetterCounts(Map<String, ActivityModel> activities, Date fromDate, Date toDate) {
        applyGroupedCount(
                "select substring(l.creator.userId, 1, locate(':', l.creator.userId) - 1), count(l.id) "
                        + "from LetterModule l where l.started between :fromDate and :toDate and l.status='F' "
                        + "group by substring(l.creator.userId, 1, locate(':', l.creator.userId) - 1)",
                activities,
                ActivityModel::setNumOfLetters,
                query -> {
                    query.setParameter("fromDate", fromDate);
                    query.setParameter("toDate", toDate);
                });
    }

    private void applyMonthlyLabCounts(Map<String, ActivityModel> activities, LocalDate fromLocalDate, LocalDate toLocalDate) {
        applyGroupedCount(
                "select substring(l.patientId, 1, locate(':', l.patientId) - 1), count(l.id) "
                        + "from NLaboModule l where l.sampleDate between :fromDate and :toDate "
                        + "group by substring(l.patientId, 1, locate(':', l.patientId) - 1)",
                activities,
                ActivityModel::setNumOfLabTests,
                query -> {
                    query.setParameter("fromDate", fromLocalDate.toString());
                    query.setParameter("toDate", toLocalDate.toString());
                });
    }

    private LocalDate toLocalDate(Date date) {
        return date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private Date toDateAtStartOfDay(LocalDate date) {
        return Date.from(date.atStartOfDay(ZoneId.systemDefault()).toInstant());
    }

    private Date toDateAtEndOfDay(LocalDate date) {
        return Date.from(date.atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant());
    }

    private LocalDateTime toLocalDateTime(Date date) {
        return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
    }

    @SuppressWarnings("unchecked")
    private List<FacilityModel> loadFacilities() {
        return (List<FacilityModel>) em.createQuery("from FacilityModel f").getResultList();
    }

    private FacilityModel findFacilityModel(String fid) {
        return (FacilityModel) em.createQuery("from FacilityModel f where f.facilityId=:fid")
                .setParameter(FID, fid)
                .getSingleResult();
    }

    private String getBindAddress() {
        String test = null;
        if (configurationResolver != null) {
            test = configurationResolver.systemNetwork().bindAddress();
        }
        if (test==null) {
            try {
                InetAddress ip = InetAddress.getLocalHost();
                if (ip!=null) {
                    test = ip.toString();
                }
            } catch (UnknownHostException ex) {
                LOGGER.error("", ex);
            }
        }
        return test;
    }
    
    private void log(String name, String value) { 
        LOGGER.info("{}={}", name, value);
    }
    
    private void log(String msg, long count) { 
        LOGGER.info("{}={}", msg, count);
    }

    private void log(String msg, long count, long total) { 
        LOGGER.info("{}={} / {}", msg, count, total);
    }
//s.oh$
}
