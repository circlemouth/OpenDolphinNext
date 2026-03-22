package open.dolphin.orca.service;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.spi.CDI;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
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
import open.dolphin.orca.service.OrcaWrapperServiceSupport.DateRange;
import open.dolphin.orca.service.OrcaWrapperServiceSupport.InsuranceSelection;

/**
 * Coordinates transport + XML conversion for ORCA wrapper endpoints.
 */
@ApplicationScoped
public class OrcaWrapperService {

    public static final String BLOCKER_TAG = "TrialLocalOnly";
    public static final int MAX_APPOINTMENT_RANGE_DAYS = 31;
    public static final int MAX_VISIT_RANGE_DAYS = 31;

    private OrcaTransport transport;

    private OrcaXmlMapper mapper;

    private final OrcaWrapperServiceSupport support = new OrcaWrapperServiceSupport();

    public OrcaWrapperService() {
        // CDI proxy requires a public no-arg constructor.
    }

    /**
     * Constructor for manual instantiation (e.g., tests).
     */
    public OrcaWrapperService(OrcaTransport transport, OrcaXmlMapper mapper) {
        this.transport = transport;
        this.mapper = mapper;
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

    public OrcaAppointmentListResponse getAppointmentList(OrcaAppointmentListRequest request) {
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
            String xml = transport.invoke(OrcaEndpoint.APPOINTMENT_LIST, payload);
            OrcaAppointmentListResponse daily = mapper.toAppointmentList(xml);
            if (aggregate == null) {
                aggregate = daily;
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

    public PatientAppointmentListResponse getPatientAppointments(PatientAppointmentListRequest request) {
        ensureNotNull(request, "patient appointment request");
        String payload = buildPatientAppointmentListPayload(request);
        String xml = transport.invoke(OrcaEndpoint.PATIENT_APPOINTMENT_LIST, payload);
        PatientAppointmentListResponse response = mapper.toPatientAppointments(xml);
        if (response != null) {
            response.setRecordsReturned(response.getReservations().size());
        }
        enrich(response, null);
        return response;
    }

    public BillingSimulationResponse simulateBilling(BillingSimulationRequest request) {
        ensureNotNull(request, "billing simulation request");
        InsuranceSelection insurance = resolveInsuranceSelection(request);
        String payload = buildBillingSimulationPayload(request, insurance);
        String xml = transport.invoke(OrcaEndpoint.BILLING_SIMULATION, payload);
        BillingSimulationResponse response = mapper.toBillingSimulation(xml);
        enrich(response, null);
        return response;
    }

    public VisitPatientListResponse getVisitList(VisitPatientListRequest request) {
        ensureNotNull(request, "visit list request");
        DateRange range = resolveVisitRange(request);
        String payload = buildVisitListPayload(request, range);
        String xml = transport.invoke(OrcaEndpoint.VISIT_LIST, payload);
        VisitPatientListResponse response = mapper.toVisitList(xml);
        if (response != null) {
            response.setRecordsReturned(response.getVisits().size());
        }
        if (range.from().equals(range.to())) {
            response.setVisitDate(range.from().toString());
        } else {
            response.setVisitDate(range.from() + "/" + range.to());
        }
        enrich(response, null);
        return response;
    }

    public PatientIdListResponse getPatientIdList(PatientIdListRequest request) {
        ensureNotNull(request, "patient id list request");
        String payload = buildPatientIdListPayload(request);
        String xml = transport.invoke(OrcaEndpoint.PATIENT_ID_LIST, payload);
        PatientIdListResponse response = mapper.toPatientIdList(xml);
        enrich(response, null);
        return response;
    }

    public PatientBatchResponse getPatientBatch(PatientBatchRequest request) {
        ensureNotNull(request, "patient batch request");
        String payload = buildPatientBatchPayload(request);
        String xml = transport.invoke(OrcaEndpoint.PATIENT_BATCH, payload);
        PatientBatchResponse response = mapper.toPatientBatch(xml);
        if (!request.isIncludeInsurance()) {
            for (PatientDetail detail : response.getPatients()) {
                detail.getInsurances().clear();
                detail.getPublicInsurances().clear();
            }
        }
        enrich(response, null);
        return response;
    }

    public PatientSearchResponse searchPatients(PatientNameSearchRequest request) {
        ensureNotNull(request, "patient search request");
        String payload = buildPatientSearchPayload(request);
        String xml = transport.invoke(OrcaEndpoint.PATIENT_NAME_SEARCH, payload);
        String searchTerm = request.getName() != null ? request.getName() : request.getKana();
        PatientSearchResponse response = mapper.toPatientSearch(xml, searchTerm);
        enrich(response, null);
        return response;
    }

    public InsuranceCombinationResponse getInsuranceCombinations(InsuranceCombinationRequest request) {
        ensureNotNull(request, "insurance combination request");
        String payload = buildInsuranceCombinationPayload(request);
        String xml = transport.invoke(OrcaEndpoint.INSURANCE_COMBINATION, payload);
        InsuranceCombinationResponse response = mapper.toInsuranceCombination(xml);
        enrich(response, null);
        return response;
    }

    public FormerNameHistoryResponse getFormerNames(FormerNameHistoryRequest request) {
        ensureNotNull(request, "former name request");
        String payload = buildFormerNameHistoryPayload(request);
        String xml = transport.invoke(OrcaEndpoint.FORMER_NAME_HISTORY, payload);
        FormerNameHistoryResponse response = mapper.toFormerNames(xml);
        enrich(response, null);
        return response;
    }

    public AppointmentMutationResponse mutateAppointment(AppointmentMutationRequest request) {
        ensureNotNull(request, "appointment mutation request");
        String payload = buildAppointmentMutationPayload(request);
        String xml = transport.invoke(OrcaEndpoint.APPOINTMENT_MUTATION, payload);
        AppointmentMutationResponse response = mapper.toAppointmentMutation(xml);
        enrich(response, null);
        return response;
    }

    public VisitMutationResponse mutateVisit(VisitMutationRequest request) {
        ensureNotNull(request, "visit mutation request");
        String payload = buildVisitMutationPayload(request);
        String xml = transport.invoke(OrcaEndpoint.ACCEPTANCE_MUTATION, payload);
        VisitMutationResponse response = mapper.toVisitMutation(xml);
        enrich(response, null);
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
    private OrcaWrapperServiceSupport.DateRange resolveAppointmentRange(OrcaAppointmentListRequest request) { return support.resolveAppointmentRange(request); }
    private void enforceRangeLimit(LocalDate from, LocalDate to, int maxDays, String label) { support.enforceRangeLimit(from, to, maxDays, label); }
    private String buildVisitListPayload(VisitPatientListRequest request, OrcaWrapperServiceSupport.DateRange range) { return support.buildVisitListPayload(request, range); }
    private OrcaWrapperServiceSupport.DateRange resolveVisitRange(VisitPatientListRequest request) { return support.resolveVisitRange(request); }
    private String buildPatientAppointmentListPayload(PatientAppointmentListRequest request) { return support.buildPatientAppointmentListPayload(request); }
    private String buildBillingSimulationPayload(BillingSimulationRequest request, OrcaWrapperServiceSupport.InsuranceSelection selection) { return support.buildBillingSimulationPayload(request, selection); }
    private OrcaWrapperServiceSupport.InsuranceSelection resolveInsuranceSelection(BillingSimulationRequest request) { return support.resolveInsuranceSelection(request, this); }
    private InsuranceCombination selectInsurance(PatientDetail detail, LocalDate performDate) { return support.selectInsurance(detail, performDate); }
    private java.util.List<PublicInsuranceInfo> selectPublicInsurances(PatientDetail detail, InsuranceCombination insurance, LocalDate performDate) { return support.selectPublicInsurances(detail, insurance, performDate); }
    private boolean isEffectiveOn(String start, String end, LocalDate target) { return support.isEffectiveOn(start, end, target); }
    private LocalDate parseOrcaDate(String value) { return support.parseOrcaDate(value); }
    private void appendInsuranceInfo(StringBuilder builder, OrcaWrapperServiceSupport.InsuranceSelection selection) { support.appendInsuranceInfo(builder, selection); }
    private String buildPatientIdListPayload(PatientIdListRequest request) { return support.buildPatientIdListPayload(request); }
    private String buildPatientBatchPayload(PatientBatchRequest request) { return support.buildPatientBatchPayload(request); }
    private String buildPatientSearchPayload(PatientNameSearchRequest request) { return support.buildPatientSearchPayload(request); }
    private String buildInsuranceCombinationPayload(InsuranceCombinationRequest request) { return support.buildInsuranceCombinationPayload(request); }
    private String buildFormerNameHistoryPayload(FormerNameHistoryRequest request) { return support.buildFormerNameHistoryPayload(request); }
    private String buildAppointmentMutationPayload(AppointmentMutationRequest request) { return support.buildAppointmentMutationPayload(request); }
    private String buildVisitMutationPayload(VisitMutationRequest request) { return support.buildVisitMutationPayload(request); }
    private void appendTag(StringBuilder builder, String tag, String value) { support.appendTag(builder, tag, value); }
    private void appendXml2Tag(StringBuilder builder, String tag, String value) { support.appendXml2Tag(builder, tag, value); }
}
