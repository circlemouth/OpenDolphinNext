package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import jakarta.annotation.PostConstruct;
import jakarta.ejb.Singleton;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.BundleMed;
import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.rest.dto.LegacyKarteListResponse;
import open.dolphin.rest.support.KarteRevisionResponseMapper;
import open.dolphin.rest.support.LegacyOrcaResponseMapper;

/**
 *
 * @author Kazushi Minagawa. Digital Globe, Inc.
 */
@Singleton
@Path("/orca")
public class OrcaResource {
    private static final Logger LOGGER = Logger.getLogger(OrcaResource.class.getName());
    
    private static final String RP_KBN_START = "2";
    private static final String SHINRYO_KBN_START = ".";
    private static final int SHINRYO_KBN_LENGTH = 3;
    private static final int DEFAULT_BUNDLE_NUMBER = 1;
    private static final String KBN_RP = "220";
    private static final String KBN_RAD = "700";
    private static final String KBN_GENERAL = "999";
    
    private int hospNum = 1;
    private String dbVersion;
    
    private boolean rpOut = true;

    @Inject
    private ORCAConnection orcaConnection;

    @Inject
    private OrcaTransport orcaTransport;

    @Inject
    private ServerConfigurationResolver configurationResolver;
    
//    private static final String QUERY_DICEASE_BY_NAME
//            = "select byomeicd, byomei, byomeikana, icd10, haisiymd from tbl_byomei where (byomei ~ ? or byomeikana ~?) and haisiymd >= ?";

    private static final String QUERY_DICEASE_BY_NAME_46
            = "select byomeicd, byomei, byomeikana, icd10_1, haisiymd from tbl_byomei where (byomei ~ ? or byomeikana ~?) and haisiymd >= ?";
    
//minagawa^ 2013/08/29
    //@Resource(mappedName="java:jboss/datasources/OrcaDS")
    //private DataSource ds;
//minagawa$
    
    private boolean DEBUG;

    //masuda^
    //ORCAのデータベースバージョンとhospNumを取得する
    @PostConstruct
    public void setupParams() {
        
        DEBUG = Logger.getLogger("open.dolphin").getLevel().equals(java.util.logging.Level.FINE);
        log("OrcaResource: setupParams");
        hospNum = 1;

        try {
            ServerRuntimeConfiguration.OrcaLegacySettings settings = getConfigurationResolver().orcaLegacy();
            String jmari = settings.facilityJmariCode();
            String prescriptionMode = settings.defaultPrescriptionInOut();
            OrcaLegacyTensuSupport.SetupParams params = OrcaLegacyTensuSupport.resolveSetupParams(
                    this::getConnection,
                    jmari,
                    "out".equalsIgnoreCase(prescriptionMode));
            rpOut = params.rpOut();

            if (jmari == null || jmari.isBlank()) {
                LOGGER.warning("ORCA facility JMARI code is not configured; using default hospNum=1.");
                return;
            }
            hospNum = params.hospNum();
            dbVersion = params.dbVersion();
            log("ORCA 病院番号="+hospNum);
            log("ORCA Version="+dbVersion);
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to initialize ORCA setup parameters", e);
        }
    }
    //masuda$
    
    public String getFacilityCodeBy1001() {
       
//s.oh^ 2013/10/17 ローカルORCA対応
        try {
            ServerRuntimeConfiguration.OrcaLegacySettings settings = getConfigurationResolver().orcaLegacy();
            String jmari = settings.facilityJmariCode();
            String hcfacility = settings.healthcareFacilityCode();
            if(jmari != null && jmari.length() == 12 && hcfacility != null && hcfacility.length() == 10) {
                StringBuilder ret = new StringBuilder();
                ret.append(hcfacility);
                ret.append("JPN");
                ret.append(jmari);
                return ret.toString();
            }
        } catch (RuntimeException ex) {
            Logger.getLogger(OrcaResource.class.getName()).log(Level.SEVERE, null, ex);
        }
//s.oh$
        Connection con = null;
        try {
            con = getConnection();
            return OrcaLegacyTensuSupport.resolveFacilityCodeBy1001(con);
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to resolve facility identifiers", e);
            processError(e);
        } finally {
            closeConnection(con);
        }
        return "";
    }

    private ServerConfigurationResolver getConfigurationResolver() {
        return configurationResolver != null ? configurationResolver : new ServerConfigurationResolver();
    }
    
    @GET
    @Path("/tensu/shinku/{param}/")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyOrcaResponseMapper.TensuListResponse getTensutensuByShinku(@PathParam("param") String param) {

        // パラメーターを取得する
        String[] params = OrcaLegacyRequestSupport.splitParamSafely(param);
        String shinku = OrcaLegacyRequestSupport.pickParam(params, 0);
        String now = OrcaLegacyRequestSupport.defaultNow(OrcaLegacyRequestSupport.pickParam(params, 1));

        if (shinku == null || shinku.isBlank()) {
            return LegacyOrcaResponseMapper.toTensuListResponse(new ArrayList<>());
        }

        Connection con = null;
        try {
            con = getConnection();
            return LegacyOrcaResponseMapper.toTensuListResponse(
                    OrcaLegacyTensuSupport.loadByShinku(con, shinku, now));
        } catch (Exception e) {
            processError(e);
        } finally {
            closeConnection(con);
        }
        return null;
    }

    @GET
    @Path("/tensu/name/{param}/")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyOrcaResponseMapper.TensuListResponse getTensuMasterByName(@PathParam("param") String param) {
        
        // パラメーターを取得する
        String[] params = OrcaLegacyRequestSupport.splitParamSafely(param);
        String name = OrcaLegacyRequestSupport.pickParam(params, 0);
        String now = OrcaLegacyRequestSupport.defaultNow(OrcaLegacyRequestSupport.pickParam(params, 1));
        boolean partialMatch = OrcaLegacyRequestSupport.parseBooleanOrDefault(
                OrcaLegacyRequestSupport.pickParam(params, 2), true);

        if (name == null || name.isBlank()) {
            return LegacyOrcaResponseMapper.toTensuListResponse(new ArrayList<>());
        }

        Connection con = null;
        try {
            con = getConnection();
            return LegacyOrcaResponseMapper.toTensuListResponse(
                    OrcaLegacyTensuSupport.loadByName(con, name, now, partialMatch));
        } catch (Exception e) {
            processError(e);
        } finally {
            closeConnection(con);
        }
        return null;
    }

    @GET
    @Path("/tensu/code/{param}/")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyOrcaResponseMapper.TensuListResponse getTensuMasterByCode(@PathParam("param") String param) {
        
        // パラメーターを取得する
        String[] params = OrcaLegacyRequestSupport.splitParamSafely(param);
        String regExp = OrcaLegacyRequestSupport.pickParam(params, 0);
        String now = OrcaLegacyRequestSupport.defaultNow(OrcaLegacyRequestSupport.pickParam(params, 1));

        if (regExp == null || regExp.isBlank()) {
            return LegacyOrcaResponseMapper.toTensuListResponse(new ArrayList<>());
        }

        Connection con = null;
        try {
            con = getConnection();
            return LegacyOrcaResponseMapper.toTensuListResponse(
                    OrcaLegacyTensuSupport.loadByCode(con, regExp, now));
        } catch (Exception e) {
            processError(e);
        } finally {
            closeConnection(con);
        }
        return null;
    }


    public LegacyOrcaResponseMapper.DiseaseListResponse getDiseaseByName(String param) {
        
        // パラメーターを取得する
        String[] params = OrcaLegacyRequestSupport.splitParamSafely(param);
        String name = params[0];
        String now = params[1];
        boolean partialMatch = Boolean.parseBoolean(params[2]);
        ArrayList<open.dolphin.infomodel.DiseaseEntry> list = new ArrayList<>();

        // SQL 文
        StringBuilder buf = new StringBuilder();
        
//        //masuda^ Version46 対応
//        if (ORCA_DB_VER46.equals(getOrcaDbVersion())) {
//            buf.append(QUERY_DICEASE_BY_NAME_46);
//        } else {
//            buf.append(QUERY_DICEASE_BY_NAME);
//        }
//        //masuda$
        buf.append(QUERY_DICEASE_BY_NAME_46);
        
        String sql = buf.toString();

        Connection con = null;
        PreparedStatement ps;

        if (!partialMatch) {
            name = "^"+name;
        }

        try
        {
            con = getConnection();
            ps = con.prepareStatement(sql);
            ps.setString(1, name);
            ps.setString(2, name);
            ps.setString(3, now);

            ResultSet rs = ps.executeQuery();

            while (rs.next()) {

                open.dolphin.infomodel.DiseaseEntry de = new open.dolphin.infomodel.DiseaseEntry();
                de.setCode(rs.getString(1));        // Code
                de.setName(rs.getString(2));        // Name
                de.setKana(rs.getString(3));         // Kana
                de.setIcdTen(rs.getString(4));      // IcdTen
                de.setDisUseDate(rs.getString(5));  // DisUseDate
                list.add(de);
            }

            rs.close();
            ps.close();
            
            return LegacyOrcaResponseMapper.toDiseaseListResponse(list);

        } catch (Exception e) {
            processError(e);

        } finally {
            closeConnection(con);
        }

        return null;
    }
    
    //--------------------------------------------------------------------------
    // 一般名を検索する
    //--------------------------------------------------------------------------
    @GET
    @Path("/general/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyOrcaResponseMapper.CodeNamePackResponse getGeneralName(@PathParam("param") String param) throws Exception {
        
        Connection con = null;
        try {
            con = getConnection();
            return LegacyOrcaResponseMapper.toCodeNamePackResponse(
                    OrcaLegacyTensuSupport.resolveGeneralName(con, param));
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to resolve general name", e);
            processError(e);
        } finally {
            closeConnection(con);
        }
        
        return null;
    }
    
    
    /**
     * 指定された入力セットコードから診療セットを Stamp にして返す。
     * @param inputSetInfo 入力セットの StampInfo
     * @return 入力セットのStampリスト
     */
    @GET
    @Path("/stamp/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyKarteListResponse.ModuleListResponse getStamp(@PathParam("param") String param, @QueryParam("date") String date) {
        OrcaStampSupport.StampRequest request = OrcaStampSupport.parseStampRequest(
                param,
                date,
                OrcaLegacyRequestSupport::resolveEffectiveDate);
        debug("OrcaResource: getStamp");
        debug("setCd = " + request.setCd());
        debug("stampName = " + request.stampName());
        debug("effectiveDate = " + request.effectiveDate());

        Connection con = null;
        try {
            con = getConnection();
            ArrayList<ModuleModel> retSet = OrcaStampSupport.loadStampModules(
                    con,
                    hospNum,
                    request,
                    this::createStamp,
                    this::debug);
            for (ModuleModel mm : retSet) {
                mm.setBeanJson(ModelUtils.encodeModule(mm));
                mm.setModel(null);
            }
            return LegacyKarteListResponse.ModuleListResponse.ofMapped(
                    KarteRevisionResponseMapper.mapModuleResponses(retSet));
        } catch (Exception e) {
            processError(e);
        } finally {
            closeConnection(con);
        }
        return null;
    }

    /**
     * Stampを生成する。
     * @param stampName Stamp名
     * @param code 診療区分コード
     * @return Stamp
     */
    private ModuleModel createStamp(String stampName, String code) {
        
        ModuleModel stamp = null;
        
        if (code != null) {
            
            if (code.startsWith(SHINRYO_KBN_START)) {
                code = code.substring(1);
            }
            
            if (code.length() > SHINRYO_KBN_LENGTH) {
                code = code.substring(0, SHINRYO_KBN_LENGTH);
            }
            
            stamp = new ModuleModel();
            ModuleInfoBean stampInfo = stamp.getModuleInfoBean();
            stampInfo.setStampName(stampName);
            stampInfo.setStampRole(IInfoModel.ROLE_P);  // ROLE_ORCA -> EOLE_P
            //stampInfo.setStampMemo(code);
            BundleDolphin bundle;
                
            if (code.startsWith(RP_KBN_START)) {
                
                bundle = new BundleMed();
                stamp.setModel(bundle);
                
                String inOut = rpOut
                               ? ClaimConst.EXT_MEDICINE
                               : ClaimConst.IN_MEDICINE;
                bundle.setMemo(inOut);
                
            } else {
                
                bundle = new BundleDolphin();
                stamp.setModel(bundle);
            }
            
            bundle.setClassCode(code);
            bundle.setClassCodeSystem(ClaimConst.CLASS_CODE_ID);
            //bundle.setClassName(MMLTable.getClaimClassCodeName(code));
            bundle.setBundleNumber(String.valueOf(DEFAULT_BUNDLE_NUMBER));

            String[] entityOrder = getEntityOrderName(code);
            if (entityOrder != null) {
                stampInfo.setEntity(entityOrder[0]);
                bundle.setOrderName(entityOrder[1]);
            }
        } 
        
        return stamp;
    }
    
    private String[] getEntityOrderName(String receiptCode) {
        
        try {
            int number = Integer.parseInt(receiptCode);
            
            if (number >= 110 && number <= 125) {
                return new String[]{IInfoModel.ENTITY_BASE_CHARGE_ORDER, "診断料"};
            
            } else if (number >= 130 && number <= 150) {
                return new String[]{IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "指導・在宅"};
                
            } else if (number >= 200 && number <= 299) {
                return new String[]{IInfoModel.ENTITY_MED_ORDER, "RP"};
            
            } 
//minagawa^ LSC 1.4 .334問題 2013/06/24
//            else if (number >= 300 && number <= 352) {
//                return new String[]{IInfoModel.ENTITY_INJECTION_ORDER, "注 射"};
//            } 
            else if (number >= 300 && number <= 399) {
                return new String[]{IInfoModel.ENTITY_INJECTION_ORDER, "注 射"};
            } 
//minagawa$            
            else if (number >= 400 && number <= 499) {
                return new String[]{IInfoModel.ENTITY_TREATMENT, "処 置"};
            
            } else if (number >= 500 && number <= 599) {
                return new String[]{IInfoModel.ENTITY_SURGERY_ORDER, "手術"};
            
            } else if (number >= 600 && number <= 699) {
                return new String[]{IInfoModel.ENTITY_LABO_TEST, "検査"};
            
            } else if (number >= 700 && number <= 799) {
                return new String[]{IInfoModel.ENTITY_RADIOLOGY_ORDER, "放射線"};
            
            } else if (number >= 800 && number <= 899) {
                return new String[]{IInfoModel.ENTITY_OTHER_ORDER, "その他"};
                
            } else {
                return new String[]{IInfoModel.ENTITY_GENERAL_ORDER, "汎 用"};
            }
            
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "Failed to classify ORCA entity", e);
        }
        
        return null;
    }
   
    
    //--------------------------------------------------------------------------
    // ORCA 病名インポート
    //--------------------------------------------------------------------------
    
    /**
     * ORCA に登録してある病名を検索する。
     * @return RegisteredDiagnosisModelのリスト
     */
    public LegacyOrcaResponseMapper.RegisteredDiagnosisListResponse getOrcaDisease(
            String param,
            String fromQuery,
            String toQuery,
            String activeOnlyQuery,
            String ascendQuery) {

        OrcaDiseaseQuerySupport.DiseaseRequest request = OrcaDiseaseQuerySupport.parseDiseaseRequest(
                param,
                fromQuery,
                toQuery,
                activeOnlyQuery,
                ascendQuery,
                OrcaLegacyRequestSupport::normalizeOrcaDate,
                OrcaLegacyRequestSupport::defaultNow,
                OrcaLegacyRequestSupport::parseBooleanOrDefault);
        if (request.patientId() == null || request.patientId().isBlank()) {
            warn("patientId=null");
            return null;
        }
        if (request.activeOnly()) {
            String activeParam = request.patientId() + "," + Boolean.toString(request.ascend());
            return getActiveOrcaDisease(activeParam);
        }

        Connection con = null;
        try {
            con = getConnection();
            String ptid = OrcaDiseaseQuerySupport.resolvePatientId(con, this.hospNum, request.patientId(), this::debug);
            if (ptid == null) {
                warn("ptid=null");
                return null;
            }
            ArrayList<RegisteredDiagnosisModel> collection = OrcaDiseaseQuerySupport.loadDiagnoses(
                    con,
                    this.hospNum,
                    ptid,
                    request,
                    this::debug,
                    OrcaLegacyRequestSupport::toDolphinDate,
                    OrcaDiagnosisCodingSupport::storeSuspectedDiagnosis,
                    OrcaDiagnosisCodingSupport::storeMainDiagnosis,
                    OrcaDiagnosisCodingSupport::storeOutcome);
            return LegacyOrcaResponseMapper.toRegisteredDiagnosisListResponse(collection);
        } catch (Exception e) {
            warn(e.getMessage());
            processError(e);
        } finally {
            closeConnection(con);
        }
        return null;
    }


    /**
     * ORCA に登録してある直近の病名を検索する。
     * @return RegisteredDiagnosisModelのリスト
     */
    public LegacyOrcaResponseMapper.RegisteredDiagnosisListResponse getActiveOrcaDisease(String param) {
        OrcaDiseaseQuerySupport.ActiveDiseaseRequest request = OrcaDiseaseQuerySupport.parseActiveDiseaseRequest(param);
        Connection con = null;
        try {
            con = getConnection();
            String ptid = OrcaDiseaseQuerySupport.resolvePatientId(con, this.hospNum, request.patientId(), this::debug);
            if (ptid == null) {
                warn("ptid=null");
                return null;
            }
            ArrayList<RegisteredDiagnosisModel> collection = OrcaDiseaseQuerySupport.loadActiveDiagnoses(
                    con,
                    this.hospNum,
                    ptid,
                    request,
                    this::debug,
                    OrcaLegacyRequestSupport::toDolphinDate,
                    OrcaDiagnosisCodingSupport::storeSuspectedDiagnosis,
                    OrcaDiagnosisCodingSupport::storeMainDiagnosis,
                    OrcaDiagnosisCodingSupport::storeOutcome);
            return LegacyOrcaResponseMapper.toRegisteredDiagnosisListResponse(collection);
        } catch (Exception e) {
            warn(e.getMessage());
            processError(e);
        } finally {
            closeConnection(con);
        }
        return null;
    }
    
//s.oh^ 2014/03/13 傷病名削除診療科対応
    public Response getDeptInfo(HttpServletRequest request) {
        String ret = "";
        try {
            if (orcaTransport == null) {
                throw OrcaDepartmentInfoSupport.orcaConfigMissing();
            }
            ret = orcaTransport.invoke(OrcaEndpoint.SYSTEM_MANAGEMENT_LIST,
                    OrcaDepartmentInfoSupport.buildSystemManagementRequest(
                            OrcaDepartmentInfoSupport.currentBaseDate()));
            log(ret);
            ret = OrcaDepartmentInfoSupport.sanitizeResponse(ret);
        } catch (WebApplicationException ex) {
            throw ex;
        } catch (OrcaGatewayException ex) {
            LOGGER.log(Level.SEVERE, "Failed to resolve ORCA department info", ex);
            throw OrcaDepartmentInfoSupport.orcaUnavailable();
        } catch (RuntimeException ex) {
            LOGGER.log(Level.SEVERE, "Failed to resolve ORCA department info", ex);
            throw OrcaDepartmentInfoSupport.orcaUnavailable();
        }

        return Response.ok(ret, MediaType.TEXT_PLAIN_TYPE).build();
    }
//s.oh$
    
    private Connection getConnection() throws SQLException {
//minagawa^ 2013/08/29
        //return ds.getConnection();
        return resolveOrcaConnection().getConnection();
//minagawa$
    }
    
    private void closeConnection(Connection conn) {
        if (conn != null) {
            try {
                conn.close();
            } catch (Exception e) {
            }
        }
    }
    
    private void closeStatement(java.sql.Statement st) {
        if (st != null) {
            try {
                st.close();
            }
            catch (SQLException e) {
                LOGGER.log(Level.WARNING, "Failed to close statement", e);
            }
        }
    }
    
    private void processError(Throwable e) {
        LOGGER.log(Level.SEVERE, "OrcaResource processing failed", e);
    }
    
    private void log(String msg) {
        Logger.getLogger("open.dolphin").info(msg);
    }
    
    private void warn(String msg) {
        Logger.getLogger("open.dolphin").warning(msg);
    }
    
    private void debug(String msg) {
        if (DEBUG) {
            Logger.getLogger("open.dolphin").fine(msg);
        }
    }

    private ORCAConnection resolveOrcaConnection() {
        return orcaConnection != null ? orcaConnection : ORCAConnection.current();
    }
}
