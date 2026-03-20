/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package open.dolphin.common;

/**
 * @deprecated P3-06 以降は新規利用禁止。ORCA 接続は `server-modernized` の adapter 層へ統一する。
 */
@Deprecated(since = "2026-03", forRemoval = false)
public class OrcaConnect extends OrcaApi {

    public OrcaConnect(String host, String port, String user, String pass, String ver) {
        super();
        this.host = host;
        this.port = port;
        this.user = user;
        this.pass = pass;
        if (ver != null) {
            this.ver = ver;
        } else {
            this.ver = ORCAAPI_VER_47;
        }
        setVerInfo();
    }

    public String getOrcaAcceptListAll(String date) {
        return acceptlst(date, "", "", "", OrcaConnect.KIND_03);
    }

    public String deleteOrcaAccept(String patientID, String acceptID, String departCode, String physicianCode) {
        return acceptmod(patientID, acceptID, departCode, physicianCode, OrcaConnect.KIND_02);
    }

    public String getDepartmentInfo(String date) {
        return system01lst(date, OrcaConnect.KIND_01);
    }
}
