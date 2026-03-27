package open.dolphin.mbean;

import java.io.BufferedReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Iterator;
import java.util.Vector;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.infomodel.*;
import open.dolphin.security.xml.SecureXml;
import org.jdom.Attribute;
import org.jdom.Document;
import org.jdom.Element;
import org.jdom.Namespace;

/**
 * PVTBuilder
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
public final class PVTBuilder {

    private static final Logger LOGGER = Logger.getLogger(PVTBuilder.class.getName());

    private static final Namespace mmlCm = Namespace.getNamespace("mmlCm","http://www.medxml.net/MML/SharedComponent/Common/1.0");
    private static final Namespace mmlNm = Namespace.getNamespace("mmlNm","http://www.medxml.net/MML/SharedComponent/Name/1.0");
    private static final Namespace mmlFc = Namespace.getNamespace("mmlFc","http://www.medxml.net/MML/SharedComponent/Facility/1.0");
    private static final Namespace mmlDp = Namespace.getNamespace("mmlDp","http://www.medxml.net/MML/SharedComponent/Department/1.0");
    private static final Namespace mmlPsi = Namespace.getNamespace("mmlPsi","http://www.medxml.net/MML/SharedComponent/PersonalizedInfo/1.0");
    private static final Namespace mmlCi = Namespace.getNamespace("mmlCi","http://www.medxml.net/MML/SharedComponent/CreatorInfo/1.0");
    private static final Namespace claim = Namespace.getNamespace("claim","http://www.medxml.net/claim/claimModule/2.1");
    private static final Namespace mmlHi = Namespace.getNamespace("mmlHi","http://www.medxml.net/MML/ContentModule/HealthInsurance/1.1");
    
    private static final String MmlBody = "MmlBody";
    private static final String MmlModuleItem = "MmlModuleItem";
    private static final String docInfo = "docInfo";
    private static final String content = "content";
    private static final String contentModuleType = "contentModuleType";
    private static final String patientInfo = "patientInfo";
    private static final String healthInsurance = "healthInsurance";
    private static final String docId = "docId";
    private static final String uid = "uid";
    private static final String e_claim = "claim";
    private static final String mmlCm_Id = "mmlCm:Id";
    private static final String mmlNm_Name = "mmlNm:Name";
    private static final String repCode = "repCode";
    private static final String tableId = "tableId";
    private static final String mmlNm_family = "mmlNm:family";
    private static final String P = "P";
    private static final String I = "I";
    private static final String A = "A";
    private static final String mmlNm_given = "mmlNm:given";
    private static final String mmlNm_fullname = "mmlNm:fullname";
    private static final String mmlPi_birthday = "mmlPi:birthday";
    private static final String mmlPi_sex = "mmlPi:sex";
    private static final String mmlAd_Address = "mmlAd:Address";
    private static final String addressClass = "addressClass";
    private static final String mmlAd_full = "mmlAd:full";
    private static final String mmlAd_zip = "mmlAd:zip";
    private static final String mmlPh_Phone = "mmlPh:Phone";
    private static final String mmlPh_area = "mmlPh:area";
    private static final String mmlPh_city = "mmlPh:city";
    private static final String mmlPh_number = "mmlPh:number";
    private static final String mmlPh_memo = "mmlPh:memo";
    private static final String HealthInsuranceModule = "HealthInsuranceModule";
    private static final String insuranceClass = "insuranceClass";
    private static final String ClassCode = "ClassCode";
    private static final String insuranceNumber = "insuranceNumber";
    private static final String clientId = "clientId";
    private static final String group = "group";
    private static final String number = "number";
    private static final String familyClass = "familyClass";
    private static final String startDate = "startDate";
    private static final String expiredDate = "expiredDate";
    private static final String paymentInRatio = "paymentInRatio";
    private static final String paymentOutRatio = "paymentOutRatio";
    private static final String publicInsurance = "publicInsurance";
    private static final String priority = "priority";
    private static final String providerName = "providerName";
    private static final String provider = "provider";
    private static final String recipient = "recipient";
    private static final String paymentRatio = "paymentRatio";
    private static final String ratioType = "ratioType";
    private static final String CreatorInfo = "CreatorInfo";
    private static final String PersonalizedInfo = "PersonalizedInfo";
    private static final String Id = "Id";
    private static final String personName = "personName";
    private static final String Name = "Name";
    private static final String fullname = "fullname";
    private static final String Facility = "Facility";
    private static final String Department = "Department";
    private static final String name = "name";
    private static final String ClaimModule = "ClaimModule";
    private static final String information = "information";
    private static final String status = "status";
    private static final String registTime = "registTime";
    private static final String admitFlag = "admitFlag";
    private static final String insuranceUid = "insuranceUid";
    // 在宅関連(在宅患者登録)
    private static final String appoint = "appoint";
    private static final String memo = "memo";

    private static final char FULL_SPACE = '　';
    private static final char HALF_SPACE = ' ';
    
    private PatientModel patientModel;
    
    private AddressModel curAddress;
    
    private TelephoneModel curTelephone;
    
    private ArrayList<PVTHealthInsuranceModel> pvtInsurnaces;
    
    private PVTHealthInsuranceModel curInsurance;
    
    private PVTPublicInsuranceItemModel curPublicItem;
    
    private PVTClaim pvtClaim;
    
    private String curRepCode;

    private boolean DEBUG;
    
    public PVTBuilder() {
    }
    
    /**
     * CLAIM モジュールをパースする。
     *
     * @param reader CLAIM モジュールへの Reader
     */
    public void parse(BufferedReader reader) {
        
        try {
            var docBuilder = SecureXml.newSaxBuilder();
            Document doc = docBuilder.build(reader);
            Element root = doc.getRootElement();
            parseBody(root.getChild(MmlBody));
            reader.close();
            
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to parse PVT XML", e);
        }
    }
    
    /**
     * CLAIM モジュールをパースして得た PatientVisitModel オブジェクトを返す。
     *
     * @return パース結果の PatientVisitModel
     */
    public PatientVisitModel getProduct() {
        return PVTBuilderSupport.buildProduct(patientModel, pvtInsurnaces, pvtClaim, LOGGER);
    }
    
    // 在宅関連(在宅患者登録)
    public PVTClaim getPvtClaim() {
        return copyPvtClaim(pvtClaim);
    }
    
    /**
     * MmlBody 要素をパースする。
     *
     * @param current 要素
     */
    public void parseBody(Element body) {
        
        // MmlModuleItem のリストを得る
        List children = body.getChildren(MmlModuleItem);
        
        //----------------------------
        // それをイテレートする
        //----------------------------
        for (Iterator iterator = children.iterator(); iterator.hasNext();) {
            
            Element moduleItem = (Element)iterator.next();
            
            //---------------------------------------------------
            // ModuleItem = docInfo + content なので夫々の要素を得る
            //---------------------------------------------------
            Element docInfoEle = moduleItem.getChild(docInfo);
            Element contentEle = moduleItem.getChild(content);
            
            // docInfo の contentModuleType を調べる
            String attr = docInfoEle.getAttributeValue(contentModuleType);
            
            //------------------------------
            // contentModuleTypeで分岐する
            //------------------------------
            if (attr.equals(patientInfo)) {
                //-----------------------
                // 患者モジュールをパースする
                //-----------------------
                if (DEBUG) {
                    LOGGER.fine("Parsing patientInfo module");
                }
                patientModel = new PatientModel();
                PVTBuilderSupport.parsePatientInfo(patientModel, docInfoEle, contentEle, DEBUG, LOGGER);
                
            } else if (attr.equals(healthInsurance)) {
                //------------------------------
                // 健康保険モジュールをパースする
                // GUIDをここで取得する
                //------------------------------
                String uuid = docInfoEle.getChild(docId).getChildTextTrim(uid);
                if (DEBUG) {
                    LOGGER.fine("Parsing healthInsurance module");
                }

                if (pvtInsurnaces == null) {
                    pvtInsurnaces = new ArrayList<PVTHealthInsuranceModel>();
                }
                PVTHealthInsuranceModel currentInsurance = new PVTHealthInsuranceModel();
                currentInsurance.setGUID(uuid);
                pvtInsurnaces.add(currentInsurance);
                PVTBuilderSupport.parseHealthInsurance(currentInsurance, docInfoEle, contentEle, DEBUG, LOGGER);
                
            } else if (attr.equals(e_claim)) {
                //------------------------------
                // 受付情報をパースする
                //------------------------------
                if (DEBUG) {
                    LOGGER.fine("Parsing claim module");
                }
                pvtClaim = new PVTClaim();
                parseClaim(docInfoEle, contentEle);
//s.oh^ 2014/08/19 施設患者一括表示機能
                if(patientModel != null) {
                    patientModel.setAppMemo(pvtClaim.getClaimAppMemo());
                }
//s.oh$
                
            } else {
                LOGGER.warning("Unknown contentModuleType: " + attr);
            }
        }
    }
    
    /**
     * 患者モジュールをパースする。
     *
     * @param content 患者要素
     */
    private void parsePatientInfo(Element docInfo, Element content) {
        PVTBuilderSupport.parsePatientInfo(patientModel, docInfo, content, DEBUG, LOGGER);
    }
    
    /**
     * 健康保険モジュールをパースする。
     *
     * @param content 健康保険要素
     */
    private void parseHealthInsurance(Element docInfo, Element content) {
        PVTBuilderSupport.parseHealthInsurance(curInsurance, docInfo, content, DEBUG, LOGGER);
    }
    
    /**
     * 受付情報をパースする。
     *
     * @param content 受付情報要素
     */
    private void parseClaim(Element docInfo, Element content) {
        
        //-------------------------------------------------------
        // ClaimModule の DocInfo に含まれる診療科と担当医を抽出する
        //-------------------------------------------------------
        Element creatorInfo = docInfo.getChild(CreatorInfo, mmlCi);
        Element psiInfo = creatorInfo.getChild(PersonalizedInfo, mmlPsi);
        
        // 担当医ID
        pvtClaim.setAssignedDoctorId(psiInfo.getChildTextTrim(Id, mmlCm));
        
        // 担当医名
        Element personNameEle = psiInfo.getChild(personName, mmlPsi);
        Element nameEle = personNameEle.getChild(Name, mmlNm);
        if (nameEle != null) {
            Element fullName = nameEle.getChild(fullname, mmlNm);
            if (fullName != null) {
                pvtClaim.setAssignedDoctorName(fullName.getTextTrim());
            }
        }
        
        // 施設情報 JMARI 4.0 から
        Element facility = psiInfo.getChild(Facility, mmlFc);
        pvtClaim.setJmariCode(facility.getChildTextTrim(Id, mmlCm));
        
        // 診療科情報
        Element dept = psiInfo.getChild(Department, mmlDp);
        pvtClaim.setClaimDeptName(dept.getChildTextTrim(name, mmlDp));
        pvtClaim.setClaimDeptCode(dept.getChildTextTrim(Id, mmlCm));
        
        // ClaimInfoを解析する
        Element claimModule = content.getChild(ClaimModule, claim);
        Element claimInfo = claimModule.getChild(information, claim);
        
        // status
        pvtClaim.setClaimStatus(claimInfo.getAttributeValue(status, claim));
        
        // registTime
        pvtClaim.setClaimRegistTime(claimInfo.getAttributeValue(registTime, claim));
        
        // admitFlag
        pvtClaim.setClaimAdmitFlag(claimInfo.getAttributeValue(admitFlag, claim));
        
        // insuranceUid
        pvtClaim.setInsuranceUid(claimInfo.getAttributeValue(insuranceUid, claim));
        
        // 在宅関連(在宅患者登録)
        Element claimAppoint = claimInfo.getChild(appoint, claim);
        if(claimAppoint != null) {
            pvtClaim.setClaimAppMemo(claimAppoint.getChildTextTrim(memo, claim));
        }
        
        // DEBUG 出力
        if (DEBUG) {
            LOGGER.fine("Parsed claim metadata");
        }
    }

    private static PVTClaim copyPvtClaim(PVTClaim source) {
        if (source == null) {
            return null;
        }
        PVTClaim copy = new PVTClaim();
        copy.setClaimStatus(source.getClaimStatus());
        copy.setClaimRegistTime(source.getClaimRegistTime());
        copy.setClaimAdmitFlag(source.getClaimAdmitFlag());
        copy.setClaimDeptName(source.getClaimDeptName());
        copy.setClaimDeptCode(source.getClaimDeptCode());
        copy.setAssignedDoctorId(source.getAssignedDoctorId());
        copy.setAssignedDoctorName(source.getAssignedDoctorName());
        Vector claimAppNames = source.getClaimAppName();
        if (claimAppNames != null) {
            for (Object value : Collections.list(claimAppNames.elements())) {
                if (value != null) {
                    copy.addClaimAppName(String.valueOf(value));
                }
            }
        }
        copy.setClaimAppMemo(source.getClaimAppMemo());
        copy.setClaimItemCode(source.getClaimItemCode());
        copy.setClaimItemName(source.getClaimItemName());
        copy.setInsuranceUid(source.getInsuranceUid());
        copy.setJmariCode(source.getJmariCode());
        return copy;
    }

}
