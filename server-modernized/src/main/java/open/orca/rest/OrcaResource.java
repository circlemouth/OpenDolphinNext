package open.orca.rest;

import java.io.*;
import java.sql.*;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.logging.Level;
import java.util.logging.Logger;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.Resource;
import jakarta.ejb.Singleton;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import javax.sql.DataSource;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import open.dolphin.common.OrcaConnect;
import open.dolphin.converter.*;
import open.dolphin.infomodel.*;
import open.dolphin.rest.dto.LegacyKarteListResponse;
import open.dolphin.rest.support.KarteRevisionResponseMapper;

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
    
    //masuda^   ORCA 4.6対応など
    private static final String ORCA_DB_VER45 = "040500-1";
    private static final String ORCA_DB_VER46 = "040600-1";
    private static final String ORCA_DB_VER47 = "040700-1";
    
    private int hospNum = 1;
    private String dbVersion;
    
    private boolean rpOut = true;

    @Inject
    private ORCAConnection orcaConnection;
    
    private static final String QUERY_FACILITYID_BY_1001
            ="select kanritbl from tbl_syskanri where kanricd='1001'";
    
    private static final String QUERY_TENSU_BY_SHINKU
            = "select srycd,name,kananame,taniname,tensikibetu,ten,nyugaitekkbn,routekkbn,srysyukbn,hospsrykbn,ykzkbn,yakkakjncd,yukostymd,yukoedymd from tbl_tensu where srysyukbn ~ ? and yukostymd<= ? and yukoedymd>=?";

    private static final String QUERY_TENSU_BY_NAME
            = "select srycd,name,kananame,taniname,tensikibetu,ten,nyugaitekkbn,routekkbn,srysyukbn,hospsrykbn,ykzkbn,yakkakjncd,yukostymd,yukoedymd from tbl_tensu where (name ~ ? or kananame ~ ?) and yukostymd<= ? and yukoedymd>=?";

    private static final String QUERY_TENSU_BY_1_NAME
            = "select srycd,name,kananame,taniname,tensikibetu,ten,nyugaitekkbn,routekkbn,srysyukbn,hospsrykbn,ykzkbn,yakkakjncd,yukostymd,yukoedymd from tbl_tensu where (name = ? or kananame = ?) and yukostymd<= ? and yukoedymd>=?";

    private static final String QUERY_TENSU_BY_CODE
            = "select srycd,name,kananame,taniname,tensikibetu,ten,nyugaitekkbn,routekkbn,srysyukbn,hospsrykbn,ykzkbn,yakkakjncd,yukostymd,yukoedymd from tbl_tensu where srycd ~ ? and yukostymd<= ? and yukoedymd>=?";

    private static final String QUERY_TENSU_BY_TEN
            = "select srycd,name,kananame,taniname,tensikibetu,ten,nyugaitekkbn,routekkbn,srysyukbn,hospsrykbn,ykzkbn,yakkakjncd,yukostymd,yukoedymd from tbl_tensu where ten >= ? and ten <= ? and yukostymd<= ? and yukoedymd>=?";
    
    private static final String QUERY_TENSU_BY_TEN2
            = "select srycd,name,kananame,taniname,tensikibetu,ten,nyugaitekkbn,routekkbn,srysyukbn,hospsrykbn,ykzkbn,yakkakjncd,yukostymd,yukoedymd from tbl_tensu where ten = ? and yukostymd<= ? and yukoedymd>=?";

    private static final String QUERY_GENERAL_NAME_BY_CODE
            = "select b.srycd,genericname from tbl_tensu b,tbl_genericname c where b.srycd=? and substring(b.yakkakjncd from 1 for 9)=c.yakkakjncd order by b.yukoedymd desc";
    
//    private static final String QUERY_DICEASE_BY_NAME
//            = "select byomeicd, byomei, byomeikana, icd10, haisiymd from tbl_byomei where (byomei ~ ? or byomeikana ~?) and haisiymd >= ?";

    private static final String QUERY_DICEASE_BY_NAME_46
            = "select byomeicd, byomei, byomeikana, icd10_1, haisiymd from tbl_byomei where (byomei ~ ? or byomeikana ~?) and haisiymd >= ?";
    
    private static final String CAMMA = ",";
    
//minagawa^ 2013/08/29
    //@Resource(mappedName="java:jboss/datasources/OrcaDS")
    //private DataSource ds;
//minagawa$
    
    private boolean DEBUG;

    private static String[] splitParamSafely(String param) {
        return param != null ? param.split(CAMMA) : new String[0];
    }

    private static String pickParam(String[] params, int index) {
        if (params == null || index < 0 || index >= params.length) {
            return null;
        }
        return params[index];
    }

    private String defaultNow(String candidate) {
        if (candidate != null && !candidate.isBlank()) {
            return candidate;
        }
        return new SimpleDateFormat("yyyyMMdd").format(new Date());
    }

    private String normalizeOrcaDate(String candidate) {
        if (candidate == null) {
            return null;
        }
        String trimmed = candidate.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() == 10 && trimmed.charAt(4) == '-' && trimmed.charAt(7) == '-') {
            return trimmed.replace("-", "");
        }
        return trimmed;
    }

    private boolean parseBooleanOrDefault(String value, boolean defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return Boolean.parseBoolean(value);
    }

    private TensuListConverter toTensuConverter(List<TensuMaster> list) {
        TensuList wrapper = new TensuList();
        wrapper.setList(list != null ? list : new ArrayList<>());

        TensuListConverter conv = new TensuListConverter();
        conv.setModel(wrapper);
        return conv;
    }
    
    //masuda^
    //ORCAのデータベースバージョンとhospNumを取得する
    @PostConstruct
    public void setupParams() {
        
        DEBUG = Logger.getLogger("open.dolphin").getLevel().equals(java.util.logging.Level.FINE);
        log("OrcaResource: setupParams");
        
        Connection con1 = null;
        java.sql.Statement st1 = null;
        Connection con2 = null;
        java.sql.Statement st2 = null;
        hospNum = 1;
        
        try {
            // custom.properties から JMARI_CODEを読む
            Properties config = new Properties();

            // コンフィグファイルを読み込む
            StringBuilder sb = new StringBuilder();
            sb.append(System.getProperty("jboss.home.dir"));
            sb.append(File.separator);
            sb.append("custom.properties");
            File f = new File(sb.toString());
            FileInputStream fin = new FileInputStream(f);
            InputStreamReader r = new InputStreamReader(fin, "JISAutoDetect");
            config.load(r);
            r.close();
            
            // JMARI code
            String jmari = config.getProperty("jamri.code");
            
            // デフォルトの院内院外処方
            String test = config.getProperty("rp.default.inout");
            rpOut = (test!=null && test.equals("out"));

            // 病院番号検索　JMARI<->HospNum
            sb = new StringBuilder();
            sb.append("select hospnum, kanritbl from tbl_syskanri where kanricd='1001' and kanritbl like '%");
            sb.append(jmari);
            sb.append("%'");
            String sql = sb.toString();

            con1 = getConnection();
            st1 = con1.createStatement();
            ResultSet rs = st1.executeQuery(sql);
            if (rs.next()) {
                hospNum = rs.getInt(1);
            }

            // Version 検索
            sql = "select version from tbl_dbkanri where kanricd='ORCADB00'";

            con2 = getConnection();
            st2 = con2.createStatement();
            ResultSet rs2 = st2.executeQuery(sql);
//minagawa^ BUG            
            if (rs2.next()) {
                dbVersion = rs2.getString(1);
            }
//minagawa$  
            log("ORCA 病院番号="+hospNum);
            log("ORCA Version="+dbVersion);
            
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to initialize ORCA setup parameters", e);
            
        } finally {
            closeConnection(con1);
            closeStatement(st1);
            closeConnection(con2);
            closeStatement(st2);
        }
    }
    //masuda$
    
    public String getFacilityCodeBy1001() {
       
//s.oh^ 2013/10/17 ローカルORCA対応
        try {
            // custom.properties から 保健医療機関コードとJMARIコードを読む
            Properties config = new Properties();
            // コンフィグファイルを読み込む
            StringBuilder sb = new StringBuilder();
            sb.append(System.getProperty("jboss.home.dir"));
            sb.append(File.separator);
            sb.append("custom.properties");
            File f = new File(sb.toString());
            FileInputStream fin = new FileInputStream(f);
            InputStreamReader r = new InputStreamReader(fin, "JISAutoDetect");
            config.load(r);
            r.close();
            // JMARI code
            String jmari = config.getProperty("jamri.code");
            String hcfacility = config.getProperty("healthcarefacility.code");
            if(jmari != null && jmari.length() == 12 && hcfacility != null && hcfacility.length() == 10) {
                StringBuilder ret = new StringBuilder();
                ret.append(hcfacility);
                ret.append("JPN");
                ret.append(jmari);
                return ret.toString();
            }
        } catch (FileNotFoundException ex) {
            Logger.getLogger(OrcaResource.class.getName()).log(Level.SEVERE, null, ex);
        } catch (UnsupportedEncodingException ex) {
            Logger.getLogger(OrcaResource.class.getName()).log(Level.SEVERE, null, ex);
        } catch (IOException ex) {
            Logger.getLogger(OrcaResource.class.getName()).log(Level.SEVERE, null, ex);
        }
//s.oh$
        // SQL 文
        StringBuilder buf = new StringBuilder();
        buf.append(QUERY_FACILITYID_BY_1001);
        String sql = buf.toString();

        Connection con = null;
        PreparedStatement ps;
        
        StringBuilder ret = new StringBuilder();

        try
        {
            con = getConnection();
            ps = con.prepareStatement(sql);

            ResultSet rs = ps.executeQuery();

            if (rs.next()) {

                String line = rs.getString(1);
                
                // 保険医療機関コード 10桁
                ret.append(line.substring(0, 10));
                
                // JMARIコード JPN+12桁 (total 15)
                int index = line.indexOf("JPN");
                if (index>0) {
                    ret.append(line.substring(index, index+15));
                }
            }

            rs.close();
            ps.close();

        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to resolve facility identifiers", e);
            processError(e);

        } finally {
            closeConnection(con);
        }

        return ret.toString();        
    }
    
    @GET
    @Path("/tensu/shinku/{param}/")
    @Produces(MediaType.APPLICATION_JSON)
    public TensuListConverter getTensutensuByShinku(@PathParam("param") String param) {

        // パラメーターを取得する
        String[] params = splitParamSafely(param);
        String shinku = pickParam(params, 0);
        String now = defaultNow(pickParam(params, 1));

        if (shinku == null || shinku.isBlank()) {
            return toTensuConverter(new ArrayList<>());
        }
        
        if (!shinku.startsWith("^")) {
            shinku = "^" + shinku;
        }
        // 結果を格納するリスト
        ArrayList<TensuMaster> list = new ArrayList<TensuMaster>();

        // SQL 文
        StringBuilder buf = new StringBuilder();
        buf.append(QUERY_TENSU_BY_SHINKU);
        String sql = buf.toString();

        Connection con = null;
        PreparedStatement ps;

        try
        {
            con = getConnection();
            ps = con.prepareStatement(sql);
            ps.setString(1, shinku);
            ps.setString(2, now);
            ps.setString(3, now);

            ResultSet rs = ps.executeQuery();

            while (rs.next()) {

                TensuMaster t = new TensuMaster();
                t.setSrycd(rs.getString(1));
                t.setName(rs.getString(2));
                t.setKananame(rs.getString(3));
                t.setTaniname(rs.getString(4));
                t.setTensikibetu(rs.getString(5));
                t.setTen(rs.getString(6));
                t.setNyugaitekkbn(rs.getString(7));
                t.setRoutekkbn(rs.getString(8));
                t.setSrysyukbn(rs.getString(9));
                t.setHospsrykbn(rs.getString(10));
                t.setYkzkbn(rs.getString(11));
                t.setYakkakjncd(rs.getString(12));
                t.setYukostymd(rs.getString(13));
                t.setYukoedymd(rs.getString(14));
                list.add(t);
            }

            rs.close();
            ps.close();
            
            // Wrapper
            TensuList wrapper = new TensuList();
            wrapper.setList(list);
            
            // Converter
            TensuListConverter conv = new TensuListConverter();
            conv.setModel(wrapper);
            
            // JSON
            return conv;
            
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
    public TensuListConverter getTensuMasterByName(@PathParam("param") String param) {
        
        // パラメーターを取得する
        String[] params = splitParamSafely(param);
        String name = pickParam(params, 0);
        String now = defaultNow(pickParam(params, 1));
        boolean partialMatch = parseBooleanOrDefault(pickParam(params, 2), true);

        if (name == null || name.isBlank()) {
            return toTensuConverter(new ArrayList<>());
        }

        // 結果を格納するリスト
        ArrayList<TensuMaster> list = new ArrayList<TensuMaster>();

        // 半角英数字を全角へ変換する
        name = StringTool.toZenkakuUpperLower(name);

        // SQL 文
        boolean one = name.length()==1 ? true : false;
        StringBuilder buf = new StringBuilder();
        if (one) {
            buf.append(QUERY_TENSU_BY_1_NAME);
        } else {
            buf.append(QUERY_TENSU_BY_NAME);
            if (!partialMatch) {
                name = "^" + name;
            }
        }
        String sql = buf.toString();

        Connection con = null;
        PreparedStatement ps;

        try
        {
            con = getConnection();
            ps = con.prepareStatement(sql);
            ps.setString(1, name);
            ps.setString(2, name);
            ps.setString(3, now);
            ps.setString(4, now);

            ResultSet rs = ps.executeQuery();

            while (rs.next()) {

                TensuMaster t = new TensuMaster();
                t.setSrycd(rs.getString(1));
                t.setName(rs.getString(2));
                t.setKananame(rs.getString(3));
                t.setTaniname(rs.getString(4));
                t.setTensikibetu(rs.getString(5));
                t.setTen(rs.getString(6));
                t.setNyugaitekkbn(rs.getString(7));
                t.setRoutekkbn(rs.getString(8));
                t.setSrysyukbn(rs.getString(9));
                t.setHospsrykbn(rs.getString(10));
                t.setYkzkbn(rs.getString(11));
                t.setYakkakjncd(rs.getString(12));
                t.setYukostymd(rs.getString(13));
                t.setYukoedymd(rs.getString(14));
                list.add(t);
            }

            rs.close();
            ps.close();
            
            // Wrapper
            TensuList wrapper = new TensuList();
            wrapper.setList(list);
            
            // Converter
            TensuListConverter conv = new TensuListConverter();
            conv.setModel(wrapper);
            
            // JSON
            return conv;

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
    public TensuListConverter getTensuMasterByCode(@PathParam("param") String param) {
        
        // パラメーターを取得する
        String[] params = splitParamSafely(param);
        String regExp = pickParam(params, 0);
        String now = defaultNow(pickParam(params, 1));

        if (regExp == null || regExp.isBlank()) {
            return toTensuConverter(new ArrayList<>());
        }

        // 結果を格納するリスト
        ArrayList<TensuMaster> list = new ArrayList<TensuMaster>();

        // SQL 文
        StringBuilder buf = new StringBuilder();
        buf.append(QUERY_TENSU_BY_CODE);
        String sql = buf.toString();

        Connection con = null;
        PreparedStatement ps;

        try
        {
            con = getConnection();
            ps = con.prepareStatement(sql);
            // 増田内科 コール側で ^ をとる
            ps.setString(1, "^"+regExp);
            ps.setString(2, now);
            ps.setString(3, now);

            ResultSet rs = ps.executeQuery();

            while (rs.next()) {

                TensuMaster t = new TensuMaster();
                t.setSrycd(rs.getString(1));
                t.setName(rs.getString(2));
                t.setKananame(rs.getString(3));
                t.setTaniname(rs.getString(4));
                t.setTensikibetu(rs.getString(5));
                t.setTen(rs.getString(6));
                t.setNyugaitekkbn(rs.getString(7));
                t.setRoutekkbn(rs.getString(8));
                t.setSrysyukbn(rs.getString(9));
                t.setHospsrykbn(rs.getString(10));
                t.setYkzkbn(rs.getString(11));
                t.setYakkakjncd(rs.getString(12));
                t.setYukostymd(rs.getString(13));
                t.setYukoedymd(rs.getString(14));
                list.add(t);
            }

            rs.close();
            ps.close();
            
            // Wrapper
            TensuList wrapper = new TensuList();
            wrapper.setList(list);
            
            // Converter
            TensuListConverter conv = new TensuListConverter();
            conv.setModel(wrapper);
            
            // JSON
            return conv;

        } catch (Exception e) {
            processError(e);

        } finally {
            closeConnection(con);
        }

        return null;
    }


    public DiseaseListConverter getDiseaseByName(String param) {
        
        // パラメーターを取得する
        String[] params = param.split(CAMMA);
        String name = params[0];
        String now = params[1];
        boolean partialMatch = Boolean.parseBoolean(params[2]);

        // 結果を格納するリスト
        ArrayList<DiseaseEntry> list = new ArrayList<DiseaseEntry>();
        
        // 戻り値
        String retXml = null;

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

                DiseaseEntry de = new DiseaseEntry();
                de.setCode(rs.getString(1));        // Code
                de.setName(rs.getString(2));        // Name
                de.setKana(rs.getString(3));         // Kana
                de.setIcdTen(rs.getString(4));      // IcdTen
                de.setDisUseDate(rs.getString(5));  // DisUseDate
                list.add(de);
            }

            rs.close();
            ps.close();
            
            // Wrapper
            DiseaseList wrapper = new DiseaseList();
            wrapper.setList(list);
            
            // Converter
            DiseaseListConverter conv = new DiseaseListConverter();
            conv.setModel(wrapper);
            
            // JSON
            return conv;

        } catch (Exception e) {
            processError(e);

        } finally {
            closeConnection(con);
        }

        return null;
    }
    
// masuda^  ORCAのptidを取得する
    private long getOrcaPtID(String patientId){

        long ptid = 0;

        final String sql = "select ptid from tbl_ptnum where hospnum = ? and ptnum = ?";
        Connection con = null;
        PreparedStatement ps;

        try {
            con = getConnection();
            ps = con.prepareStatement(sql);
            ps.setInt(1, hospNum);
            ps.setString(2, patientId);

            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                ptid = rs.getLong(1);
            }
            rs.close();
            ps.close();
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to get ORCA patient ID", e);
            processError(e);
            closeConnection(con);
        } finally {
            closeConnection(con);
        }

        return ptid;
    }
    
    //masuda$
    
    //--------------------------------------------------------------------------
    // 一般名を検索する
    //--------------------------------------------------------------------------
    @GET
    @Path("/general/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public CodeNamePackConverter getGeneralName(@PathParam("param") String param) throws Exception {
        
        Connection con = null;
        PreparedStatement ps;
        String gname = null;
        CodeNamePack ret = null;

        StringBuilder sb = new StringBuilder();
        sb.append(QUERY_GENERAL_NAME_BY_CODE);
        String sql = sb.toString();
        debug(sql);
        
        try {
            con = getConnection();
            ps = con.prepareStatement(sql);
            ps.setString(1, param);

            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                ret = new CodeNamePack(param, rs.getString(2));
            }
            rs.close();
            ps.close();
            
            CodeNamePackConverter conv = new CodeNamePackConverter();
            conv.setModel(ret);
            
            return conv;
            
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to resolve general name", e);
            processError(e);
            closeConnection(con);
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
        
        String[] params = param.split(CAMMA);
        String setCd = params[0]; // stampId=setCd; セットコード
        String stampName = params[1];
        String visitDateParam = params.length >= 3 ? params[2] : null;
        if (date != null && !date.trim().isEmpty()) {
            visitDateParam = date;
        }
        String effectiveDate = resolveEffectiveDate(visitDateParam);
        debug("OrcaResource: getStamp");
        debug("setCd = " + setCd);
        debug("stampName = " + stampName);
        debug("effectiveDate = " + effectiveDate);
        
        int hospnum = -1;
        if (true) {
            hospnum = hospNum;
        }
        
        Connection con = null;
        PreparedStatement ps1 = null;
        PreparedStatement ps2 = null;
        String sql1;
        String sql2;
        String inputSetTable = "tbl_" + "input" + "set";
        
        StringBuilder sb1 = new StringBuilder();
        if (true) {
//s.oh^ 2014/04/01 ORCAセット有効期限対応
            sb1.append("select inputcd,suryo1,kaisu,yukostymd,yukoedymd from ")
                    .append(inputSetTable)
                    .append(" where hospnum=? and setcd=? order by setseq");
//s.oh$
            sql1 = sb1.toString();
        } else {
            sb1.append("select inputcd,suryo1,kaisu from ")
                    .append(inputSetTable)
                    .append(" where setcd=? order by setseq");
            sql1 = sb1.toString();
        }
        
        // order by yukoedymd desc を追加 ^
        StringBuilder sb2 = new StringBuilder();
        if (true) {
            sb2.append("select srysyukbn,name,taniname,ykzkbn from tbl_tensu where hospnum=? and srycd=? and yukostymd<=? and yukoedymd>=? order by yukoedymd desc");
            sql2 = sb2.toString();
        } else {
            sb2.append("select srysyukbn,name,taniname,ykzkbn from tbl_tensu where srycd=? and yukostymd<=? and yukoedymd>=? order by yukoedymd desc");
            sql2 = sb2.toString();
        }
        
        ArrayList<ModuleModel> retSet = new ArrayList<ModuleModel>();
        
        try {
            //
            // setCd を検索する
            //
            con = getConnection();
            ps1 = con.prepareStatement(sql1);
            if (hospnum > 0) {
                ps1.setInt(1, hospnum);
                ps1.setString(2, setCd);
            } else {
                ps1.setString(1, setCd);
            }
            debug(ps1.toString());
            
            ResultSet rs = ps1.executeQuery();
            
            ArrayList<OrcaInputSet> list = new ArrayList<OrcaInputSet>();
                
            int today = Integer.parseInt(effectiveDate);

            while (rs.next()) {

                debug("got from set table");
                OrcaInputSet inputSet = new OrcaInputSet();
                //inputSet.setHospId(rs.getString(1));
                //inputSet.setSetCd(rs.getString(2));         // P01001 ...
                //inputSet.setYukostYmd(rs.getString(3));
                //inputSet.setYukoedYmd(rs.getString(4));
                //inputSet.setSetSeq(rs.getInt(5));           // 1, 2, ...
                inputSet.setInputCd(rs.getString(1));       // .210 616130532 ...
                inputSet.setSuryo1(rs.getFloat(2));         // item の個数
                //inputSet.setSuryo2(rs.getFloat(8));
                inputSet.setKaisu(rs.getInt(3));            // バンドル数
                //inputSet.setComment(rs.getString(10));
                //inputSet.setAtai1(rs.getString(11));
                //inputSet.setAtai2(rs.getString(12));
                //inputSet.setAtai3(rs.getString(13));
                //inputSet.setAtai4(rs.getString(14));
                //inputSet.setTermId(rs.getString(15));
                //inputSet.setOpId(rs.getString(16));
                //inputSet.setCreYmd(rs.getString(17));
                //inputSet.setUpYmd(rs.getString(18));
                //inputSet.setUpHms(rs.getString(19));
                
                debug("getInputCd = " + inputSet.getInputCd());
                debug("getSuryo1 = " + String.valueOf(inputSet.getSuryo1()));
                debug("getKaisu = " + String.valueOf(inputSet.getKaisu()));
                
//s.oh^ 2014/04/01 ORCAセット有効期限対応
                //list.add(inputSet);
                String strst = rs.getString(4);
                String stred = rs.getString(5);
                debug("st = " + strst);
                debug("ed = " + stred);
                if (strst == null || stred == null) {
                    continue;
                }
                try {
                    int st = Integer.parseInt(strst);
                    int ed = Integer.parseInt(stred);
                    if (st <= today && today <= ed) {
                        list.add(inputSet);
                    }
                } catch (NumberFormatException nf) {
                    continue;
                }
//s.oh$
            }
            
            rs.close();
            closeStatement(ps1);
            
            ModuleModel stamp;
            BundleDolphin bundle = null;
            ps2 = con.prepareStatement(sql2);
            
            if (list != null && list.size() > 0) {
                
                for (OrcaInputSet inputSet : list) {
                    
                    String inputcd = inputSet.getInputCd();
                    debug("inputcd = " + inputcd);
                    
                    if (inputcd.startsWith(SHINRYO_KBN_START)) {
                        
                        //---------------------------------------
                        //
                        //---------------------------------------
                        stamp = createStamp(stampName, inputcd);
                        if (stamp != null) {
                            bundle = (BundleDolphin) stamp.getModel();
                            retSet.add(stamp);
                        }
                        debug("created stamp " + inputcd);
                        
                    } else {
                        
                        if (hospnum > 0) {
                            ps2.setInt(1, hospnum);
                            ps2.setString(2, inputcd);
                            ps2.setString(3, effectiveDate);
                            ps2.setString(4, effectiveDate);
                        } else {
                            ps2.setString(1, inputcd);
                            ps2.setString(2, effectiveDate);
                            ps2.setString(3, effectiveDate);
                        }
                        debug(ps2.toString());
                    
                        ResultSet rs2 = ps2.executeQuery();
                        
                        if (rs2.next()) {
                            
                            debug("got from tbl_tensu");
                            String code = inputcd;
                            String kbn = rs2.getString(1);
                            String name = rs2.getString(2);
                            String number = String.valueOf(inputSet.getSuryo1());
                            String unit = rs2.getString(3);
////s.oh^ 2014/06/24 ORCAセットの改善
//                            String ykz = rs2.getString(4);
////s.oh$
                            
                            debug("code = " + code);
                            debug("kbn = " + kbn);
                            debug("name = " + name);
                            debug("number = " + number);
                            debug("unit = " + unit);
                            
                            ClaimItem item = new ClaimItem();
                            item.setCode(code);
                            item.setName(name);
                            item.setNumber(number);
                            item.setClassCodeSystem(ClaimConst.SUBCLASS_CODE_ID);
////s.oh^ 2014/06/24 ORCAセットの改善
//                            item.setYkzKbn(ykz);
////s.oh$
                            
                            if (code.startsWith(ClaimConst.SYUGI_CODE_START)) {
                                //
                                // 手技の場合
                                //
                                debug("item is tech");
                                item.setClassCode(String.valueOf(ClaimConst.SYUGI));
                                
                                if (bundle == null) {
                                    stamp = createStamp(stampName, kbn);
                                    if (stamp != null) {
                                        bundle = (BundleDolphin) stamp.getModel();
                                        retSet.add(stamp);
                                    }
                                }
                                
                                if (bundle != null) {
//s.oh^ 2014/03/31 スタンプ回数対応
                                    if(inputSet.getKaisu() > 0) {
                                        bundle.setBundleNumber(String.valueOf(inputSet.getKaisu()));
                                    }
//s.oh$
                                    bundle.addClaimItem(item);
                                } 
                            
                            } else if (code.startsWith(ClaimConst.YAKUZAI_CODE_START)) {
                                //
                                // 薬剤の場合
                                //
                                debug("item is medicine");
                                item.setClassCode(String.valueOf(ClaimConst.YAKUZAI));
                                item.setNumberCode(ClaimConst.YAKUZAI_TOYORYO);
                                item.setNumberCodeSystem(ClaimConst.NUMBER_CODE_ID);
                                item.setUnit(unit);
                                
                                if (bundle == null) {
                                    String receiptCode = rs2.getString(4).equals(ClaimConst.YKZ_KBN_NAIYO)
                                            ? ClaimConst.RECEIPT_CODE_NAIYO 
                                            : ClaimConst.RECEIPT_CODE_GAIYO;
                                    stamp = createStamp(stampName, receiptCode);
                                    if (stamp != null) {
                                        bundle = (BundleDolphin) stamp.getModel();
                                        retSet.add(stamp);
                                    }
                                }
                                
                                if (bundle != null) {
//s.oh^ 2014/03/31 スタンプ回数対応
                                    if(inputSet.getKaisu() > 0) {
                                        bundle.setBundleNumber(String.valueOf(inputSet.getKaisu()));
                                    }
//s.oh$
                                    bundle.addClaimItem(item);
                                }
                                
                            } else if (code.startsWith(ClaimConst.ZAIRYO_CODE_START)) {
                                //
                                // 材料の場合
                                //
                                debug("item is material");
                                item.setClassCode(String.valueOf(ClaimConst.ZAIRYO));
                                item.setNumberCode(ClaimConst.ZAIRYO_KOSU);
                                item.setNumberCodeSystem(ClaimConst.NUMBER_CODE_ID);
                                item.setUnit(unit);
                                
                                if (bundle == null) {
                                    stamp = createStamp(stampName, KBN_GENERAL);
                                    if (stamp != null) {
                                        bundle = (BundleDolphin) stamp.getModel();
                                        retSet.add(stamp);
                                    }
                                }
                                
                                if (bundle != null) {
//s.oh^ 2014/03/31 スタンプ回数対応
                                    if(inputSet.getKaisu() > 0) {
                                        bundle.setBundleNumber(String.valueOf(inputSet.getKaisu()));
                                    }
//s.oh$
                                    bundle.addClaimItem(item);
                                }
                                
                            
                            } else if (code.startsWith(ClaimConst.ADMIN_CODE_START)) {
                                //
                                // 用法の場合
                                //
                                debug("item is administration");
                                if (bundle == null) {
                                    stamp = createStamp(stampName, KBN_RP);
                                    if (stamp != null) {
                                        bundle = (BundleDolphin) stamp.getModel();
                                        retSet.add(stamp);
                                    }
                                }
                                
                                if (bundle != null) {
                                    if (bundle instanceof BundleMed) {
                                        debug("cur bundle is BundleMed");
                                        bundle.setAdmin(name);
                                        bundle.setAdminCode(code);
                                        bundle.setBundleNumber(String.valueOf(inputSet.getKaisu()));
                                    } else {
                                        debug("cur bundle is ! BundleMed");
                                        bundle.addClaimItem(item);
                                    }
                                }
                            
                            } else if (inputcd.startsWith(ClaimConst.RBUI_CODE_START)) {
                                //
                                // 放射線部位の場合
                                //
                                debug("item is rad loc.");
                                item.setClassCode(String.valueOf(ClaimConst.SYUGI));
                                
                                if (bundle == null) {
                                    stamp = createStamp(stampName, KBN_RAD);
                                    if (stamp != null) {
                                        bundle = (BundleDolphin) stamp.getModel();
                                        retSet.add(stamp);
                                    }
                                }
                                
                                if (bundle != null) {
//s.oh^ 2014/03/31 スタンプ回数対応
                                    if(inputSet.getKaisu() > 0) {
                                        bundle.setBundleNumber(String.valueOf(inputSet.getKaisu()));
                                    }
//s.oh$
                                    bundle.addClaimItem(item);
                                }

                            } else {

                                debug("item is other");
                                if (bundle==null) {
                                    stamp = createStamp(stampName, KBN_GENERAL);
                                    if (stamp != null) {
                                        bundle = (BundleDolphin) stamp.getModel();
                                        retSet.add(stamp);
                                    }
                                }
                                if (bundle != null) {
//s.oh^ 2014/03/31 スタンプ回数対応
                                    if(inputSet.getKaisu() > 0) {
                                        bundle.setBundleNumber(String.valueOf(inputSet.getKaisu()));
                                    }
//s.oh$
                                    bundle.addClaimItem(item);
                                }
                            }
                        }
                    }
                }
                
                closeStatement(ps2);
            }
            
            closeConnection(con);
            
            for (ModuleModel mm : retSet) {
                mm.setBeanJson(ModelUtils.encodeModule(mm));
                mm.setModel(null);
            }
            
            return LegacyKarteListResponse.ModuleListResponse.ofMapped(
                    KarteRevisionResponseMapper.mapModuleResponses(retSet));
            
        } catch (Exception e) {
            processError(e);
            closeConnection(con);
            closeStatement(ps1);
            closeStatement(ps2);
        }
        
        return null; 
    }

    private String resolveEffectiveDate(String visitDateParam) {
        String candidate = visitDateParam != null ? visitDateParam.trim() : "";
        if (!candidate.isEmpty()) {
            String digits = candidate.replaceAll("[^0-9]", "");
            if (digits.length() >= 8) {
                return digits.substring(0, 8);
            }
        }
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd");
        return sdf.format(new Date());
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
    public RegisteredDiagnosisListConverter getOrcaDisease(
            String param,
            String fromQuery,
            String toQuery,
            String activeOnlyQuery,
            String ascendQuery) {

        String[] params = splitParamSafely(param);
        String patientId;
        String from;
        String to;
        boolean ascend;
        boolean activeOnly;
        if (params.length >= 4) {
            patientId = params[0];
            from = params[1];
            to = params[2];
            ascend = Boolean.parseBoolean(params[3]);
            activeOnly = false;
        } else {
            patientId = param;
            from = normalizeOrcaDate(fromQuery);
            to = normalizeOrcaDate(toQuery);
            ascend = parseBooleanOrDefault(ascendQuery, true);
            activeOnly = parseBooleanOrDefault(activeOnlyQuery, false);
        }
        if (patientId == null || patientId.isBlank()) {
            warn("patientId=null");
            return null;
        }
        if (activeOnly) {
            String activeParam = patientId + CAMMA + Boolean.toString(ascend);
            return getActiveOrcaDisease(activeParam);
        }
        if (from == null || from.isBlank()) {
            from = "19000101";
        } else {
            from = normalizeOrcaDate(from);
        }
        if (to == null || to.isBlank()) {
            to = defaultNow(to);
        } else {
            to = normalizeOrcaDate(to);
        }
        
        Connection con = null;
        ArrayList<RegisteredDiagnosisModel> collection;
        PreparedStatement pt = null;
        String sql;
        String ptid = null;
        int hospNum = this.hospNum; //-1;
        
        StringBuilder sb = new StringBuilder();
        sb.append("select ptid, ptnum from tbl_ptnum where hospnum=? and ptnum=?");
        sql = sb.toString();
        debug(sql);
        
        try {
            con = getConnection();
            pt = con.prepareStatement(sql);
            pt.setInt(1, hospNum);
            pt.setString(2, patientId);
            
            ResultSet rs = pt.executeQuery();
            if (rs.next()) {
                ptid = rs.getString(1);
            }
            closeConnection(con);
            closeStatement(pt);
            
        }  catch (Exception e) {
            warn(e.getMessage());
            processError(e);
            closeConnection(con);
            closeStatement(pt);
        }
        
        if (ptid == null) {
            warn("ptid=null");
            return null;
        }
        
        sb = new StringBuilder();
        //sb.append("select sryymd,khnbyomeicd,utagaiflg,syubyoflg,tenkikbn,tenkiymd,byomei from tbl_ptbyomei where ");
        sb.append("select sryymd,khnbyomeicd,utagaiflg,syubyoflg,tenkikbn,tenkiymd,byomei,sryka from tbl_ptbyomei where "); // 診療科追加
        if (ascend) {
            if (hospNum > 0) {
                sb.append("hospnum=? and ptid=? and sryymd >= ? and sryymd <= ? and dltflg!=? order by sryymd");
            } else {
                sb.append("ptid=? and sryymd >= ? and sryymd <= ? and dltflg!=?  order by sryymd");
            }
        } else {
            if (hospNum > 0) {
                sb.append("hospnum=? and ptid=? and sryymd >= ? and sryymd <= ? and dltflg!=?  order by sryymd desc");
            } else {
                sb.append("ptid=? and sryymd >= ? and sryymd <= ? and dltflg!=?  order by sryymd desc");
            }
        }

        sql = sb.toString();
        debug(sql);
        
        try {
            con = getConnection();
            pt = con.prepareStatement(sql);
            if (hospNum > 0) {
                pt.setInt(1, hospNum);
                pt.setInt(2, Integer.parseInt(ptid));   // 元町皮膚科
                pt.setString(3, from);
                pt.setString(4, to);
                pt.setString(5, "1");
            } else {
                pt.setInt(1, Integer.parseInt(ptid));   // 元町皮膚科
                pt.setString(2, from);
                pt.setString(3, to);
                pt.setString(4, "1");
            }
            ResultSet rs = pt.executeQuery();
            collection = new ArrayList<RegisteredDiagnosisModel>();
            
            while (rs.next()) {
                
                RegisteredDiagnosisModel ord = new RegisteredDiagnosisModel();
                
                // 疾患開始日
                ord.setStartDate(toDolphinDateStr(rs.getString(1)));
                
                // 病名コード
                ord.setDiagnosisCode(rs.getString(2));

                // 疑いフラグ
                storeSuspectedDiagnosis(ord, rs.getString(3));

                // 主病名フラグ
                storeMainDiagnosis(ord, rs.getString(4));

                // 転帰
                storeOutcome(ord, rs.getString(5));
                
                // 疾患終了日（転帰）
                ord.setEndDate(toDolphinDateStr(rs.getString(6)));
                
                // 疾患名
                ord.setDiagnosis(rs.getString(7));
                
//s.oh^ 2014/03/13 傷病名削除診療科対応
                ord.setDepartment(rs.getString(8));
//s.oh$
                
                // 制御のための Status
                ord.setStatus("ORCA");
                
                collection.add(ord);
            }
            
            rs.close();
            closeStatement(pt);
            closeConnection(con);
            
            // Wrapper
            RegisteredDiagnosisList rdl = new RegisteredDiagnosisList();
            rdl.setList(collection);
            
            // Converter
            RegisteredDiagnosisListConverter conv = new RegisteredDiagnosisListConverter();
            conv.setModel(rdl);
            
            return conv;
            
        } catch (Exception e) {
            warn(e.getMessage());
            processError(e);
            closeConnection(con);
            closeStatement(pt);
        }
        
        return null;
    }


    /**
     * ORCA に登録してある直近の病名を検索する。
     * @return RegisteredDiagnosisModelのリスト
     */
    public RegisteredDiagnosisListConverter getActiveOrcaDisease(String param) {
        
        String[] params = param.split(CAMMA);
        String patientId = params[0];
        boolean asc = Boolean.parseBoolean(params[1]);

        Connection con = null;
        ArrayList<RegisteredDiagnosisModel> collection;
        PreparedStatement pt = null;
        String sql;
        String ptid = null;
        int hospNum = this.hospNum; //-1;

        StringBuilder sb = new StringBuilder();
        sb.append("select ptid, ptnum from tbl_ptnum where hospnum=? and ptnum=?");
        sql = sb.toString();
        debug(sql);

        try {
            con = getConnection();
            pt = con.prepareStatement(sql);
            pt.setInt(1, hospNum);
            pt.setString(2, patientId);

            ResultSet rs = pt.executeQuery();
            if (rs.next()) {
                ptid = rs.getString(1);
            }
            closeConnection(con);
            closeStatement(pt);

        }  catch (Exception e) {
            warn(e.getMessage());
            processError(e);
            closeConnection(con);
            closeStatement(pt);
        }

        if (ptid == null) {
            warn("ptid=null");
            return null;
        }

        sb = new StringBuilder();
        //sb.append("select sryymd,khnbyomeicd,utagaiflg,syubyoflg,tenkikbn,tenkiymd,byomei from tbl_ptbyomei where ");
        sb.append("select sryymd,khnbyomeicd,utagaiflg,syubyoflg,tenkikbn,tenkiymd,byomei,sryka from tbl_ptbyomei where "); // 診療科追加
        if (hospNum > 0) {
//s.oh^ 2014/03/18 ORCAから傷病名の取込
            //sb.append("hospnum=? and ptid=? and tenkikbn=? and dltflg!=? order by sryymd");
            sb.append("hospnum=? and ptid=? and dltflg!=? order by sryymd");
//s.oh$
        } else {
//s.oh^ 2014/03/18 ORCAから傷病名の取込
            //sb.append("ptid=? and tenkikbn=? and dltflg!=? order by sryymd");
            sb.append("ptid=? and dltflg!=? order by sryymd");
//s.oh$
        }
        if (!asc) {
            sb.append(" desc");
        }

        sql = sb.toString();
        debug(sql);

        try {
            con = getConnection();
            pt = con.prepareStatement(sql);
            if (hospNum > 0) {
                pt.setInt(1, hospNum);
                pt.setInt(2, Integer.parseInt(ptid));   // 元町皮膚科
//s.oh^ 2014/03/18 ORCAから傷病名の取込
                //pt.setString(3, " ");
                //pt.setString(4, "1");
                pt.setString(3, "1");
//s.oh$
            } else {
                pt.setInt(1, Integer.parseInt(ptid));   // 元町皮膚科
//s.oh^ 2014/03/18 ORCAから傷病名の取込
                //pt.setString(2, " ");
                //pt.setString(3, "1");
                pt.setString(2, "1");
//s.oh$
            }
            ResultSet rs = pt.executeQuery();
            collection = new ArrayList<RegisteredDiagnosisModel>();

            while (rs.next()) {

                RegisteredDiagnosisModel ord = new RegisteredDiagnosisModel();

                // 疾患開始日
                ord.setStartDate(toDolphinDateStr(rs.getString(1)));

                // 病名コード
                ord.setDiagnosisCode(rs.getString(2));

                // 疑いフラグ
                storeSuspectedDiagnosis(ord, rs.getString(3));

                // 主病名フラグ
                storeMainDiagnosis(ord, rs.getString(4));

                // 転帰
                storeOutcome(ord, rs.getString(5));

                // 疾患終了日（転帰）
                ord.setEndDate(toDolphinDateStr(rs.getString(6)));

                // 疾患名
                ord.setDiagnosis(rs.getString(7));
                
//s.oh^ 2014/03/13 傷病名削除診療科対応
                ord.setDepartment(rs.getString(8));
//s.oh$

                // 制御のための Status
                ord.setStatus("ORCA");

                collection.add(ord);
            }

            rs.close();
            closeStatement(pt);
            closeConnection(con);
            
            // Wrapper
            RegisteredDiagnosisList rdl = new RegisteredDiagnosisList();
            rdl.setList(collection);

            // Converter
            RegisteredDiagnosisListConverter conv = new RegisteredDiagnosisListConverter();
            conv.setModel(rdl);

            return conv;
            
        } catch (Exception e) {
            warn(e.getMessage());
            processError(e);
            closeConnection(con);
            closeStatement(pt);
        }

        return null;
    }
    
//s.oh^ 2014/03/13 傷病名削除診療科対応
    public Response getDeptInfo(HttpServletRequest request) {
        String ret = "";
        try {
            // custom.properties から 保健医療機関コードとJMARIコードを読む
            Properties config = new Properties();
            // コンフィグファイルを読み込む
            StringBuilder sb = new StringBuilder();
            sb.append(System.getProperty("jboss.home.dir"));
            sb.append(File.separator);
            sb.append("custom.properties");
            File f = new File(sb.toString());
            FileInputStream fin = new FileInputStream(f);
            InputStreamReader r = new InputStreamReader(fin, "JISAutoDetect");
            config.load(r);
            r.close();
            String ip = trimToNull(config.getProperty("orca.orcaapi.ip"));
            String port = config.getProperty("orca.orcaapi.port", "8000");
            String id = trimToNull(config.getProperty("orca.id"));
            String password = trimToNull(config.getProperty("orca.password"));
            if (ip == null || id == null || password == null) {
                throw orcaConfigMissing(request);
            }
            OrcaConnect orcaApi = new OrcaConnect(ip, port, id, password, null);
            SimpleDateFormat sf = new SimpleDateFormat("yyyy-MM-dd");
            ret = orcaApi.getDepartmentInfo(sf.format(new Date()));
            log(ret);
            ret = ret.replaceAll("\\<.*?>", ",");
        } catch (FileNotFoundException ex) {
            Logger.getLogger(OrcaResource.class.getName()).log(Level.SEVERE, null, ex);
        } catch (UnsupportedEncodingException ex) {
            Logger.getLogger(OrcaResource.class.getName()).log(Level.SEVERE, null, ex);
        } catch (IOException ex) {
            Logger.getLogger(OrcaResource.class.getName()).log(Level.SEVERE, null, ex);
        }

        return Response.ok(ret, MediaType.TEXT_PLAIN_TYPE).build();
    }
//s.oh$

    private WebApplicationException orcaConfigMissing(HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "orca_config_missing");
        body.put("code", "orca_config_missing");
        body.put("errorCode", "orca_config_missing");
        body.put("message", "ORCA 接続設定が不足しています。");
        body.put("status", Response.Status.SERVICE_UNAVAILABLE.getStatusCode());
        body.put("errorCategory", "orca_config_missing");
        return new WebApplicationException(Response.status(Response.Status.SERVICE_UNAVAILABLE)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(body)
                .build());
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
    
    // ORCA カテゴリ
    private void storeSuspectedDiagnosis(RegisteredDiagnosisModel rdm, String test) {
        if (test!=null) {
            if (test.equals("1")) {
                rdm.setCategory("suspectedDiagnosis");
                rdm.setCategoryDesc("疑い病名");
                rdm.setCategoryCodeSys("MML0015");

            } else if (test.equals("2")) {
//                rdm.setCategory("suspectedDiagnosis");
//                rdm.setCategoryDesc("急性");
//                rdm.setCategoryCodeSys("MML0012");

            } else if (test.equals("3")) {
                rdm.setCategory("suspectedDiagnosis");
                rdm.setCategoryDesc("疑い病名");
                rdm.setCategoryCodeSys("MML0015");
            }
        }
    }
    
    private void storeMainDiagnosis(RegisteredDiagnosisModel rdm, String test) {
        if (test!=null && test.equals("1")) {
            rdm.setCategory("mainDiagnosis");
            rdm.setCategoryDesc("主病名");
            rdm.setCategoryCodeSys("MML0012");
        }
    }

    // ORCA 転帰
    private void storeOutcome(RegisteredDiagnosisModel rdm, String data) {
        if (data != null) {
            if (data.equals("1")) {
                rdm.setOutcome("fullyRecovered");
                rdm.setOutcomeDesc("全治");
                rdm.setOutcomeCodeSys("MML0016");

            } else if (data.equals("2")) {
                rdm.setOutcome("died");
                rdm.setOutcomeDesc("死亡");
                rdm.setOutcomeCodeSys("MML0016");

            } else if (data.equals("3")) {
                rdm.setOutcome("pause");
                rdm.setOutcomeDesc("中止");
                rdm.setOutcomeCodeSys("MML0016");

            } else if (data.equals("8")) {
                rdm.setOutcome("transfer");
                rdm.setOutcomeDesc("転医");
                rdm.setOutcomeCodeSys("MML0016");
            }
        }
    }

    private String toDolphinDateStr(String orcaDate) {
        if (orcaDate==null || orcaDate.equals("")) {
            return null;
        }
        try {
            SimpleDateFormat sdf = new SimpleDateFormat();
            sdf.applyPattern("yyyyMMdd");
            Date orca = sdf.parse(orcaDate);
            sdf.applyPattern("yyyy-MM-dd");
            String ret = sdf.format(orca);
            return ret;
        } catch (ParseException ex) {
        }

        return null;
    }
    
    private static WebApplicationException badRequest(String message) {
        return new WebApplicationException(message, Response.Status.BAD_REQUEST);
    }
    
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
