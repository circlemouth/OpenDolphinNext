package open.dolphin.orca.service;

import open.dolphin.rest.dto.orca.AppointmentMutationRequest;
import open.dolphin.rest.dto.orca.AppointmentMutationResponse;
import open.dolphin.rest.dto.orca.AcceptanceInventoryRequest;
import open.dolphin.rest.dto.orca.AcceptanceInventoryResponse;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.BillingSimulationResponse;
import open.dolphin.rest.dto.orca.FormerNameHistoryRequest;
import open.dolphin.rest.dto.orca.FormerNameHistoryResponse;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;
import open.dolphin.rest.dto.orca.InsuranceCombinationResponse;
import open.dolphin.rest.dto.orca.MedicalIdentifierPreflightRequest;
import open.dolphin.rest.dto.orca.MedicalIdentifierPreflightResponse;
import open.dolphin.rest.dto.orca.OrcaAppointmentListRequest;
import open.dolphin.rest.dto.orca.OrcaAppointmentListResponse;
import open.dolphin.rest.dto.orca.OrcaMedicalInformationListResponse;
import open.dolphin.rest.dto.orca.OrcaReceptionSelectorOptionsResponse;
import open.dolphin.rest.dto.orca.PatientAppointmentListRequest;
import open.dolphin.rest.dto.orca.PatientAppointmentListResponse;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientIdListRequest;
import open.dolphin.rest.dto.orca.PatientIdListResponse;
import open.dolphin.rest.dto.orca.PatientNameSearchRequest;
import open.dolphin.rest.dto.orca.PatientSearchResponse;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.rest.dto.orca.VisitPatientListRequest;
import open.dolphin.rest.dto.orca.VisitPatientListResponse;

public interface OrcaLiveGateway {

    String BLOCKER_TAG = "TrialLocalOnly";
    int MAX_APPOINTMENT_RANGE_DAYS = 31;
    int MAX_VISIT_RANGE_DAYS = 31;

    OrcaAppointmentListResponse getAppointmentList(String facilityId, OrcaAppointmentListRequest request);

    PatientAppointmentListResponse getPatientAppointments(String facilityId, PatientAppointmentListRequest request);

    BillingSimulationResponse simulateBilling(String facilityId, BillingSimulationRequest request);

    AcceptanceInventoryResponse getAcceptanceInventory(String facilityId, AcceptanceInventoryRequest request);

    MedicalIdentifierPreflightResponse getMedicalIdentifierPreflight(
            String facilityId, MedicalIdentifierPreflightRequest request);

    VisitPatientListResponse getVisitList(String facilityId, VisitPatientListRequest request);

    PatientIdListResponse getPatientIdList(String facilityId, PatientIdListRequest request);

    PatientBatchResponse getPatientBatch(String facilityId, PatientBatchRequest request);

    PatientSearchResponse searchPatients(String facilityId, PatientNameSearchRequest request);

    OrcaMedicalInformationListResponse getMedicalInformationOptions(String facilityId);

    OrcaReceptionSelectorOptionsResponse getReceptionSelectorOptions(String facilityId);

    InsuranceCombinationResponse getInsuranceCombinations(String facilityId, InsuranceCombinationRequest request);

    FormerNameHistoryResponse getFormerNames(String facilityId, FormerNameHistoryRequest request);

    AppointmentMutationResponse mutateAppointment(String facilityId, AppointmentMutationRequest request);

    VisitMutationResponse mutateVisit(String facilityId, VisitMutationRequest request);
}
