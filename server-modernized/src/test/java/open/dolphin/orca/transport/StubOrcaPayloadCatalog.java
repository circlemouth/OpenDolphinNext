package open.dolphin.orca.transport;

import java.util.EnumMap;
import java.util.Map;
import open.dolphin.orca.OrcaGatewayException;

final class StubOrcaPayloadCatalog {

    private static final Map<OrcaEndpoint, String> RESOURCES = new EnumMap<>(OrcaEndpoint.class);

    static {
        RESOURCES.put(OrcaEndpoint.ACCEPTANCE_LIST, "orca/stub/05_acceptlstv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.APPOINTMENT_LIST, "orca/stub/06_appointlstv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.PATIENT_APPOINTMENT_LIST, "orca/stub/15_appointlst2v2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.BILLING_SIMULATION, "orca/stub/16_acsimulatev2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.VISIT_LIST, "orca/stub/18_visitptlstv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.PATIENT_ID_LIST, "orca/stub/08_patientlst1v2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.PATIENT_BATCH, "orca/stub/09_patientlst2v2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.PATIENT_NAME_SEARCH, "orca/stub/10_patientlst3v2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.INSURANCE_COMBINATION, "orca/stub/35_patientlst6v2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.FORMER_NAME_HISTORY, "orca/stub/51_patientlst8v2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.APPOINTMENT_MUTATION, "orca/stub/02_appointmodv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.ACCEPTANCE_MUTATION, "orca/stub/04_acceptmodv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.SYSTEM_MANAGEMENT_LIST, "orca/stub/44_system01lstv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.MANAGE_USERS, "orca/stub/45_manageusersv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.INSURANCE_PROVIDER, "orca/stub/46_insprogetv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.PRESCRIPTION_REPORT, "orca/stub/47_prescriptionv2_response.sample.json");
        RESOURCES.put(OrcaEndpoint.PATIENT_GET, "orca/stub/52_patientgetv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.PATIENT_MOD, "orca/stub/53_patientmodv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.PATIENT_MEMO_LIST, "orca/stub/54_patientlst7v2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.PATIENT_MEMO_MOD, "orca/stub/55_patientmemomodv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.DISEASE_GET, "orca/stub/56_diseasegetv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.DISEASE_MOD_V3, "orca/stub/57_diseasev3_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.MEDICAL_GET, "orca/stub/58_medicalgetv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.MEDICAL_MOD, "orca/stub/59_medicalmodv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.TEMP_MEDICAL_GET, "orca/stub/60_tmedicalgetv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.INCOME_INFO, "orca/stub/62_incomeinfv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.SUBJECTIVES_LIST, "orca/stub/63_subjectiveslstv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.SUBJECTIVES_MOD, "orca/stub/64_subjectivesv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.CONTRAINDICATION_CHECK, "orca/stub/65_contraindicationcheckv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.MEDICATION_GET, "orca/stub/66_medicationgetv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.MEDICATION_MOD, "orca/stub/67_medicatonmodv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.MASTER_LAST_UPDATE, "orca/stub/68_masterlastupdatev3_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.SYSTEM_INFO, "orca/stub/69_systeminfv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.SYSTEM_DAILY, "orca/stub/70_system01dailyv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.INSURANCE_LIST, "orca/stub/71_insuranceinf1v2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.MEDICAL_SET, "orca/stub/72_medicalsetv2_response.sample.xml");
        RESOURCES.put(OrcaEndpoint.PUSH_EVENT_GET, "orca/stub/73_pusheventgetv2_response.sample.json");
        RESOURCES.put(OrcaEndpoint.MEDICINE_NOTEBOOK_REPORT, "orca/stub/74_medicinenotebookv2_response.sample.json");
        RESOURCES.put(OrcaEndpoint.KARTENO1_REPORT, "orca/stub/75_karteno1v2_response.sample.json");
        RESOURCES.put(OrcaEndpoint.KARTENO3_REPORT, "orca/stub/76_karteno3v2_response.sample.json");
        RESOURCES.put(OrcaEndpoint.INVOICE_RECEIPT_REPORT, "orca/stub/77_invoicereceiptv2_response.sample.json");
        RESOURCES.put(OrcaEndpoint.STATEMENT_REPORT, "orca/stub/78_statementv2_response.sample.json");
    }

    private StubOrcaPayloadCatalog() {
    }

    static String resourceFor(OrcaEndpoint endpoint) {
        if (endpoint == null) {
            throw new OrcaGatewayException("Endpoint must not be null");
        }
        String resource = RESOURCES.get(endpoint);
        if (resource == null) {
            throw new OrcaGatewayException("Stub payload is not registered for " + endpoint.name());
        }
        return resource;
    }
}
