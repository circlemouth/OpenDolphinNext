package open.dolphin.orca.service;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.spi.CDI;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.function.Function;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.rest.dto.orca.AppointmentMutationRequest;
import open.dolphin.rest.dto.orca.AppointmentMutationResponse;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.BillingSimulationResponse;
import open.dolphin.rest.dto.orca.FormerNameHistoryRequest;
import open.dolphin.rest.dto.orca.FormerNameHistoryResponse;
import open.dolphin.rest.dto.orca.InsuranceCombination;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;
import open.dolphin.rest.dto.orca.InsuranceCombinationResponse;
import open.dolphin.rest.dto.orca.OrcaApiResponse;
import open.dolphin.rest.dto.orca.OrcaAppointmentListRequest;
import open.dolphin.rest.dto.orca.OrcaAppointmentListResponse;
import open.dolphin.rest.dto.orca.OrcaMedicalInformationListResponse;
import open.dolphin.rest.dto.orca.PatientAppointmentListRequest;
import open.dolphin.rest.dto.orca.PatientAppointmentListResponse;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientIdListRequest;
import open.dolphin.rest.dto.orca.PatientIdListResponse;
import open.dolphin.rest.dto.orca.PatientNameSearchRequest;
import open.dolphin.rest.dto.orca.PatientSearchResponse;
import open.dolphin.rest.dto.orca.PublicInsuranceInfo;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.rest.dto.orca.VisitPatientListRequest;
import open.dolphin.rest.dto.orca.VisitPatientListResponse;
import open.dolphin.orca.service.OrcaLiveGatewaySupport.DateRange;
import open.dolphin.orca.service.OrcaLiveGatewaySupport.InsuranceSelection;

/**
 * Coordinates transport + XML conversion for ORCA wrapper endpoints.
 */
@ApplicationScoped
public class DefaultOrcaLiveGateway implements OrcaLiveGateway {

    static final String BLOCKER_TAG = "TrialLocalOnly";
    static final int MAX_APPOINTMENT_RANGE_DAYS = 31;
    static final int MAX_VISIT_RANGE_DAYS = 31;

    private OrcaTransport transport;

    private OrcaXmlMapper mapper;

    private final OrcaLiveGatewaySupport support = new OrcaLiveGatewaySupport();

    public DefaultOrcaLiveGateway() {
        // CDI proxy requires a public no-arg constructor.
    }

    /**
     * Constructor for manual instantiation (e.g., tests).
     */
    public DefaultOrcaLiveGateway(OrcaTransport transport, OrcaXmlMapper mapper) {
        this.transport = transport;
        this.mapper = new OrcaXmlMapper();
    }

    @PostConstruct
    private void initializeDependencies() {
        if (transport == null) {
            transport = CDI.current().select(RestOrcaTransport.class).get();
        }
        if (mapper == null) {
            mapper = CDI.current().select(OrcaXmlMapper.class).get();
        }
        ensureNotNull(transport, "OrcaTransport");
        ensureNotNull(mapper, "OrcaXmlMapper");
    }

    public OrcaAppointmentListResponse getAppointmentList(String facilityId, OrcaAppointmentListRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "appointment request");
        if (request.getAppointmentDate() == null && request.getFromDate() == null && request.getToDate() == null) {
            throw new OrcaGatewayException("appointmentDate or fromDate/toDate is required");
        }
        DateRange range = resolveAppointmentRange(request);
        LocalDate from = range.from();
        LocalDate to = range.to();
        OrcaAppointmentListResponse aggregate = null;
        for (LocalDate cursor = from; !cursor.isAfter(to); cursor = cursor.plusDays(1)) {
            String payload = buildAppointmentListPayload(cursor, request);
            OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.APPOINTMENT_LIST, OrcaTransportRequest.post(payload));
            String xml = result != null ? result.getBody() : null;
            OrcaAppointmentListResponse daily = mapResponse(xml, mapper::toAppointmentList);
            if (aggregate == null) {
                aggregate = daily != null ? daily : new OrcaAppointmentListResponse();
                if (daily == null) {
                    aggregate.setApiResult("00");
                    aggregate.setApiResultMessage("No data");
                }
            } else if (daily != null) {
                aggregate.getSlots().addAll(daily.getSlots());
            }
        }
        if (aggregate == null) {
            aggregate = new OrcaAppointmentListResponse();
            aggregate.setApiResult("00");
            aggregate.setApiResultMessage("No data");
        }
        if (from.equals(to)) {
            aggregate.setAppointmentDate(from.toString());
        } else {
            aggregate.setAppointmentDate(from + "/" + to);
        }
        aggregate.setRecordsReturned(aggregate.getSlots().size());
        enrich(aggregate, null);
        return aggregate;
    }

    public PatientAppointmentListResponse getPatientAppointments(String facilityId, PatientAppointmentListRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "patient appointment request");
        String payload = buildPatientAppointmentListPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.PATIENT_APPOINTMENT_LIST, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        PatientAppointmentListResponse response = mapResponse(xml, mapper::toPatientAppointments);
        if (response == null) {
            response = new PatientAppointmentListResponse();
        }
        response.setRecordsReturned(response.getReservations().size());
        enrich(response, result);
        return response;
    }

    public BillingSimulationResponse simulateBilling(String facilityId, BillingSimulationRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "billing simulation request");
        InsuranceSelection insurance = resolveInsuranceSelection(facilityId, request);
        String payload = buildBillingSimulationPayload(request, insurance);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.BILLING_SIMULATION, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        BillingSimulationResponse response = mapResponse(xml, mapper::toBillingSimulation);
        if (response == null) {
            response = new BillingSimulationResponse();
        }
        enrich(response, result);
        return response;
    }

    public VisitPatientListResponse getVisitList(String facilityId, VisitPatientListRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "visit list request");
        DateRange range = resolveVisitRange(request);
        String payload = buildVisitListPayload(request, range);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.VISIT_LIST, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        VisitPatientListResponse response = mapResponse(xml, mapper::toVisitList);
        if (response == null) {
            response = new VisitPatientListResponse();
        }
        response.setRecordsReturned(response.getVisits().size());
        if (range.from().equals(range.to())) {
            response.setVisitDate(range.from().toString());
        } else {
            response.setVisitDate(range.from() + "/" + range.to());
        }
        enrich(response, result);
        return response;
    }

    public PatientIdListResponse getPatientIdList(String facilityId, PatientIdListRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "patient id list request");
        String payload = buildPatientIdListPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.PATIENT_ID_LIST, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        PatientIdListResponse response = mapResponse(xml, mapper::toPatientIdList);
        if (response == null) {
            response = new PatientIdListResponse();
        }
        enrich(response, result);
        return response;
    }

    public PatientBatchResponse getPatientBatch(String facilityId, PatientBatchRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "patient batch request");
        String payload = buildPatientBatchPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.PATIENT_BATCH, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        PatientBatchResponse response = mapResponse(xml, mapper::toPatientBatch);
        if (response == null) {
            response = new PatientBatchResponse();
        }
        if (!request.isIncludeInsurance()) {
            for (PatientDetail detail : response.getPatients()) {
                detail.getInsurances().clear();
                detail.getPublicInsurances().clear();
            }
        }
        enrich(response, result);
        return response;
    }

    public PatientSearchResponse searchPatients(String facilityId, PatientNameSearchRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "patient search request");
        String payload = buildPatientSearchPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.PATIENT_NAME_SEARCH, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        String searchTerm = request.getName();
        PatientSearchResponse response = mapResponse(xml, v -> mapper.toPatientSearch(v, searchTerm));
        if (response == null) {
            response = new PatientSearchResponse();
        }
        enrich(response, result);
        return response;
    }

    public OrcaMedicalInformationListResponse getMedicalInformationOptions(String facilityId) {
        facilityId = requireText(facilityId, "facilityId");
        String payload = buildMedicalInformationOptionsPayload();
        OrcaTransportResult result =
                transport.invoke(facilityId, OrcaEndpoint.SYSTEM_MANAGEMENT_LIST, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        OrcaMedicalInformationListResponse response = mapResponse(xml, mapper::toMedicalInformationList);
        if (response == null) {
            response = new OrcaMedicalInformationListResponse();
        }
        response.setRecordsReturned(response.getItems().size());
        enrich(response, result);
        return response;
    }

    public InsuranceCombinationResponse getInsuranceCombinations(String facilityId, InsuranceCombinationRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "insurance combination request");
        String payload = buildInsuranceCombinationPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.INSURANCE_COMBINATION, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        InsuranceCombinationResponse response = mapResponse(xml, mapper::toInsuranceCombination);
        if (response == null) {
            response = new InsuranceCombinationResponse();
        }
        enrich(response, result);
        return response;
    }

    public FormerNameHistoryResponse getFormerNames(String facilityId, FormerNameHistoryRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "former name request");
        String payload = buildFormerNameHistoryPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.FORMER_NAME_HISTORY, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        FormerNameHistoryResponse response = mapResponse(xml, mapper::toFormerNames);
        if (response == null) {
            response = new FormerNameHistoryResponse();
        }
        enrich(response, result);
        return response;
    }

    public AppointmentMutationResponse mutateAppointment(String facilityId, AppointmentMutationRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "appointment mutation request");
        String payload = buildAppointmentMutationPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.APPOINTMENT_MUTATION, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        AppointmentMutationResponse response = mapResponse(xml, mapper::toAppointmentMutation);
        if (response == null) {
            response = new AppointmentMutationResponse();
        }
        enrich(response, result);
        return response;
    }

    public VisitMutationResponse mutateVisit(String facilityId, VisitMutationRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "visit mutation request");
        String payload = buildVisitMutationPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.ACCEPTANCE_MUTATION, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        VisitMutationResponse response = mapResponse(xml, mapper::toVisitMutation);
        if (response == null) {
            response = new VisitMutationResponse();
        }
        enrich(response, result);
        return response;
    }

    private void enrich(OrcaApiResponse response, OrcaTransportResult result) { support.enrich(response, result); }
    private String resolveDataSource(OrcaTransportResult result) { return support.resolveDataSource(result); }
    private void ensureNotNull(Object target, String label) { support.ensureNotNull(target, label); }
    private String requireText(String value, String label) { return support.requireText(value, label); }
    private String requireNumericId(String value, String label) { return support.requireNumericId(value, label); }
    private String buildOrcaMeta(OrcaEndpoint endpoint, String classCode) { return support.buildOrcaMeta(endpoint, classCode); }
    private String normalizeAppointmentClass(String value) { return support.normalizeAppointmentClass(value); }
    private String normalizeAcceptRequestNumber(String value) { return support.normalizeAcceptRequestNumber(value); }
    private String normalizeToken(String value, String label) { return support.normalizeToken(value, label); }
    private String padTwoDigits(String value) { return support.padTwoDigits(value); }
    private String resolveAppointmentListClass(OrcaAppointmentListRequest request) { return support.resolveAppointmentListClass(request); }
    private String buildAppointmentListPayload(LocalDate date, OrcaAppointmentListRequest request) { return support.buildAppointmentListPayload(date, request); }
    private OrcaLiveGatewaySupport.DateRange resolveAppointmentRange(OrcaAppointmentListRequest request) { return support.resolveAppointmentRange(request); }
    private void enforceRangeLimit(LocalDate from, LocalDate to, int maxDays, String label) { support.enforceRangeLimit(from, to, maxDays, label); }
    private String buildVisitListPayload(VisitPatientListRequest request, OrcaLiveGatewaySupport.DateRange range) { return support.buildVisitListPayload(request, range); }
    private OrcaLiveGatewaySupport.DateRange resolveVisitRange(VisitPatientListRequest request) { return support.resolveVisitRange(request); }
    private String buildPatientAppointmentListPayload(PatientAppointmentListRequest request) { return support.buildPatientAppointmentListPayload(request); }
    private String buildBillingSimulationPayload(BillingSimulationRequest request, OrcaLiveGatewaySupport.InsuranceSelection selection) { return support.buildBillingSimulationPayload(request, selection); }
    private OrcaLiveGatewaySupport.InsuranceSelection resolveInsuranceSelection(String facilityId, BillingSimulationRequest request) { return support.resolveInsuranceSelection(facilityId, request, this); }
    private InsuranceCombination selectInsurance(PatientDetail detail, LocalDate performDate) { return support.selectInsurance(detail, performDate); }
    private java.util.List<PublicInsuranceInfo> selectPublicInsurances(PatientDetail detail, InsuranceCombination insurance, LocalDate performDate) { return support.selectPublicInsurances(detail, insurance, performDate); }
    private boolean isEffectiveOn(String start, String end, LocalDate target) { return support.isEffectiveOn(start, end, target); }
    private LocalDate parseOrcaDate(String value) { return support.parseOrcaDate(value); }
    private void appendInsuranceInfo(StringBuilder builder, OrcaLiveGatewaySupport.InsuranceSelection selection) { support.appendInsuranceInfo(builder, selection); }
    private String buildPatientIdListPayload(PatientIdListRequest request) { return support.buildPatientIdListPayload(request); }
    private String buildPatientBatchPayload(PatientBatchRequest request) { return support.buildPatientBatchPayload(request); }
    private String buildPatientSearchPayload(PatientNameSearchRequest request) { return support.buildPatientSearchPayload(request); }
    private String buildMedicalInformationOptionsPayload() { return support.buildMedicalInformationOptionsPayload(); }
    private String buildInsuranceCombinationPayload(InsuranceCombinationRequest request) { return support.buildInsuranceCombinationPayload(request); }
    private String buildFormerNameHistoryPayload(FormerNameHistoryRequest request) { return support.buildFormerNameHistoryPayload(request); }
    private String buildAppointmentMutationPayload(AppointmentMutationRequest request) { return support.buildAppointmentMutationPayload(request); }
    private String buildVisitMutationPayload(VisitMutationRequest request) { return support.buildVisitMutationPayload(request); }
    private void appendTag(StringBuilder builder, String tag, String value) { support.appendTag(builder, tag, value); }
    private void appendXml2Tag(StringBuilder builder, String tag, String value) { support.appendXml2Tag(builder, tag, value); }
    private <T> T mapResponse(String xml, Function<String, T> converter) { return xml != null ? converter.apply(xml) : null; }

    private static String requireFacilityId(String facilityId) {
        if (facilityId == null || facilityId.isBlank()) {
            throw new OrcaGatewayException("facilityId is required");
        }
        return facilityId.trim();
    }
}
