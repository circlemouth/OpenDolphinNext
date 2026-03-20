/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package open.dolphin.common;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.apache.commons.codec.binary.Base64;

/**
 * ORCA APIクラス
 *
 * @deprecated P3-06 以降は新規利用禁止。ORCA 連携は `server-modernized` の adapter 層へ集約する。
 */
@Deprecated(since = "2026-03", forRemoval = false)
public class OrcaApi {
    private static final String URL_HTTP = "http://";
    public static final String REQUESTMETHOD_POST = "POST";

    public static final String ORCAAPI_VER_47 = "47";

    public static final String KIND_01 = "?class=01";
    public static final String KIND_02 = "?class=02";
    public static final String KIND_03 = "?class=03";

    private static final String ORCAAPI47_ACCEPTLIST = "/api01rv2/acceptlstv2";
    private String acceptList;

    private static final String ORCAAPI47_APPOINTLIST = "/api01rv2/appointlstv2";
    private String appointList;

    private static final String ORCAAPI47_GETDISEASE = "/api01rv2/diseasegetv2";
    private String getDisease;

    private static final String ORCAAPI47_APPOINTLIST2 = "/api01rv2/appointlst2v2";
    private String appointList2;

    private static final String ORCAAPI47_ACCEPTMOD = "/orca11/acceptmodv2";
    private String acceptMod;

    private static final String ORCAAPI47_SYSTEM01LST = "/api01rv2/system01lstv2";
    private String system01List;

    protected String host;
    protected String port;
    protected String user;
    protected String pass;
    protected String ver;

    protected OrcaApi() {
        super();
        init();
    }

    void init() {
        host = null;
        port = null;
        user = null;
        pass = null;
        ver = null;
    }

    protected void setVerInfo() {
        if (ORCAAPI_VER_47.equals(ver)) {
            acceptList = ORCAAPI47_ACCEPTLIST;
            appointList = ORCAAPI47_APPOINTLIST;
            getDisease = ORCAAPI47_GETDISEASE;
            appointList2 = ORCAAPI47_APPOINTLIST2;
            acceptMod = ORCAAPI47_ACCEPTMOD;
            system01List = ORCAAPI47_SYSTEM01LST;
        }
    }

    protected String acceptlst(String date, String dcode, String pcode, String medical, String kind) {
        StringBuilder sbParam = new StringBuilder();
        sbParam.append("<data>");
        sbParam.append("<acceptlstreq type=\"record\">");
        sbParam.append("<Acceptance_Date type=\"string\">");
        sbParam.append(date);
        sbParam.append("</Acceptance_Date>");
        sbParam.append("<Department_Code type=\"string\">");
        sbParam.append(dcode);
        sbParam.append("</Department_Code>");
        sbParam.append("<Physician_Code type=\"string\">");
        sbParam.append(pcode);
        sbParam.append("</Physician_Code>");
        sbParam.append("<Medical_Information type=\"string\">");
        sbParam.append(medical);
        sbParam.append("</Medical_Information>");
        sbParam.append("</acceptlstreq>");
        sbParam.append("</data>");
        return orcaSendRecv(acceptList + kind, sbParam.toString());
    }

    protected String appointlst(String date, String medical, String pcode, String kind) {
        StringBuilder sbParam = new StringBuilder();
        sbParam.append("<data>");
        sbParam.append("<appointlstreq type=\"record\">");
        sbParam.append("<Appointment_Date type=\"string\">");
        sbParam.append(date);
        sbParam.append("</Appointment_Date>");
        sbParam.append("<Medical_Information type=\"string\">");
        sbParam.append(medical);
        sbParam.append("</Medical_Information>");
        sbParam.append("<Physician_Code type=\"string\">");
        sbParam.append(pcode);
        sbParam.append("</Physician_Code>");
        sbParam.append("</appointlstreq>");
        sbParam.append("</data>");
        return orcaSendRecv(appointList + kind, sbParam.toString());
    }

    protected String diseaseget(String pid, String date, String kind) {
        StringBuilder sbParam = new StringBuilder();
        sbParam.append("<data>");
        sbParam.append("<disease_inforeq type=\"record\">");
        sbParam.append("<Patient_ID type=\"string\">");
        sbParam.append(pid);
        sbParam.append("</Patient_ID>");
        sbParam.append("<Base_Date type=\"string\">");
        sbParam.append(date);
        sbParam.append("</Base_Date>");
        sbParam.append("</disease_inforeq>");
        sbParam.append("</data>");
        return orcaSendRecv(getDisease + kind, sbParam.toString());
    }

    protected String appointlst2(String pid, String date, String kind) {
        StringBuilder sbParam = new StringBuilder();
        sbParam.append("<data>");
        sbParam.append("<appointlstreq2 type=\"record\">");
        sbParam.append("<Patient_ID type=\"string\">");
        sbParam.append(pid);
        sbParam.append("</Patient_ID>");
        sbParam.append("<Base_Date type=\"string\">");
        sbParam.append(date);
        sbParam.append("</Base_Date>");
        sbParam.append("</appointlstreq2>");
        sbParam.append("</data>");
        return orcaSendRecv(appointList2 + kind, sbParam.toString());
    }

    protected String acceptmod(String pid, String accept, String depart, String physician, String kind) {
        StringBuilder sbParam = new StringBuilder();
        sbParam.append("<data>");
        sbParam.append("<acceptreq type=\"record\">");
        sbParam.append("<Patient_ID type=\"string\">");
        sbParam.append(pid);
        sbParam.append("</Patient_ID>");
        sbParam.append("<Acceptance_Id type=\"string\">");
        sbParam.append(accept);
        sbParam.append("</Acceptance_Id>");
        sbParam.append("<Department_Code type=\"string\">");
        sbParam.append(depart);
        sbParam.append("</Department_Code>");
        sbParam.append("<Physician_Code type=\"string\">");
        sbParam.append(physician);
        sbParam.append("</Physician_Code>");
        sbParam.append("</acceptrea>");
        sbParam.append("</data>");
        return orcaSendRecv(acceptMod + kind, sbParam.toString());
    }

    protected String system01lst(String date, String kind) {
        StringBuilder sbParam = new StringBuilder();
        sbParam.append("<data>");
        sbParam.append("<system01_managereq type=\"record\">");
        sbParam.append("<Base_Date type=\"string\">");
        sbParam.append(date);
        sbParam.append("</Base_Date>");
        sbParam.append("</system01_managereq>");
        sbParam.append("</data>");
        return orcaSendRecv(system01List + kind, sbParam.toString());
    }

    protected String orcaSendRecv(String urlInfo, String data) {
        StringBuilder ret = new StringBuilder();
        try {
            StringBuilder urlStr = new StringBuilder();
            urlStr.append(URL_HTTP);
            urlStr.append(host);
            urlStr.append(":");
            urlStr.append(port);
            urlStr.append(urlInfo);
            URL url = new URL(urlStr.toString());
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setDoOutput(true);
            connection.setUseCaches(false);
            connection.setRequestMethod(REQUESTMETHOD_POST);
            connection.setRequestProperty("Content-Type", "application/xml");

            byte[] encoded = Base64.encodeBase64((user + ":" + pass).getBytes(StandardCharsets.UTF_8));
            connection.setRequestProperty("Authorization", "Basic " + new String(encoded, StandardCharsets.UTF_8));

            byte[] requestBody = data.getBytes(StandardCharsets.UTF_8);
            connection.setRequestProperty("Content-Length", Integer.toString(requestBody.length));

            try (PrintWriter printWriter =
                    new PrintWriter(new OutputStreamWriter(connection.getOutputStream(), StandardCharsets.UTF_8), true)) {
                printWriter.print(data);
            }

            InputStream is = connection.getInputStream();
            BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            String line;
            while ((line = reader.readLine()) != null) {
                ret.append(line);
            }
            reader.close();

            connection.disconnect();
        } catch (MalformedURLException ex) {
            Logger.getLogger(OrcaApi.class.getName()).log(Level.SEVERE, null, ex);
        } catch (Exception ex) {
            Logger.getLogger(OrcaApi.class.getName()).log(Level.SEVERE, null, ex);
        }
        return ret.toString();
    }
}
