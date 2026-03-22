package open.dolphin.mbean;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import open.dolphin.infomodel.AddressModel;
import open.dolphin.infomodel.PVTHealthInsuranceModel;
import open.dolphin.infomodel.PVTClaim;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.infomodel.TelephoneModel;
import org.jdom.Element;
import org.jdom.Namespace;
import org.junit.jupiter.api.Test;

class PVTBuilderTest {

    private static final Namespace MML_HI =
            Namespace.getNamespace("mmlHi", "http://www.medxml.net/MML/ContentModule/HealthInsurance/1.1");

    @Test
    void parseHealthInsurance_handlesMissingInsuranceClassElement() throws Exception {
        PVTBuilder builder = new PVTBuilder();
        PVTHealthInsuranceModel insurance = new PVTHealthInsuranceModel();
        setField(builder, "curInsurance", insurance);

        Element docInfo = new Element("docInfo");
        Element content = new Element("content");
        Element module = new Element("HealthInsuranceModule", MML_HI);
        module.addContent(new Element("insuranceNumber", MML_HI).setText("12345"));
        content.addContent(module);

        Method method = PVTBuilder.class.getDeclaredMethod("parseHealthInsurance", Element.class, Element.class);
        method.setAccessible(true);

        assertDoesNotThrow(() -> method.invoke(builder, docInfo, content));
        assertNull(insurance.getInsuranceClass());
        assertEquals("12345", insurance.getInsuranceNumber());
    }

    @Test
    void parsePatientInfo_and_getProduct_normalizePatientData() throws Exception {
        PVTBuilder builder = new PVTBuilder();
        PatientModel patient = new PatientModel();
        patient.setFullName("山田　太郎");
        patient.setKanaName("ヤマダ　タロウ");
        AddressModel address = new AddressModel();
        address.setZipCode("100-0001");
        address.setAddress("東京都　千代田区　丸の内ー１");
        patient.setAddresses(List.of(address));
        TelephoneModel telephone = new TelephoneModel();
        telephone.setMemo("03-1234-5678");
        patient.setTelephones(List.of(telephone));

        PVTHealthInsuranceModel insurance = new PVTHealthInsuranceModel();
        insurance.setInsuranceClass("国保");
        insurance.setInsuranceNumber("12345");

        PVTClaim claim = new PVTClaim();
        claim.setClaimStatus("regist");
        claim.setClaimDeptCode("01");
        claim.setClaimDeptName("内科");
        claim.setAssignedDoctorId("D001");
        claim.setAssignedDoctorName("Dr. Test");
        claim.setJmariCode("J123");
        claim.setClaimRegistTime("2000-01-02T03:04:05");
        claim.setInsuranceUid("uuid-1");

        setField(builder, "patientModel", patient);
        setField(builder, "pvtInsurnaces", new ArrayList<>(List.of(insurance)));
        setField(builder, "pvtClaim", claim);

        PatientVisitModel model = builder.getProduct();

        assertNotNull(model);
        assertEquals("山田 太郎", patient.getFullName());
        assertEquals("山田", patient.getFamilyName());
        assertEquals("太郎", patient.getGivenName());
        assertEquals("ヤマダ タロウ", patient.getKanaName());
        assertEquals("ヤマダ", patient.getKanaFamilyName());
        assertEquals("タロウ", patient.getKanaGivenName());
        assertEquals("03-1234-5678", patient.getTelephone());
        assertNotNull(patient.getSimpleAddressModel());
        assertEquals("東京都 千代田区 丸の内-１", patient.getSimpleAddressModel().getAddress());
        assertEquals(patient, model.getPatientModel());
        assertEquals("内科", model.getDeptName());
        assertEquals("D001", model.getDoctorId());
        assertEquals(LocalDateTime.of(2000, 1, 2, 3, 4, 5), model.getPvtDate());
        assertEquals("国保", model.getFirstInsurance());
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
