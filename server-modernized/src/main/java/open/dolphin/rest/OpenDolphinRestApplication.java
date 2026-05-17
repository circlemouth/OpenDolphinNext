package open.dolphin.rest;

import jakarta.ws.rs.ApplicationPath;
import jakarta.ws.rs.core.Application;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Single public REST entrypoint for the modernized server.
 */
@ApplicationPath("/api")
public final class OpenDolphinRestApplication extends Application {

    private static final Set<Class<?>> REGISTERED_CLASSES = createRegisteredClasses();

    private static Set<Class<?>> createRegisteredClasses() {
        LinkedHashSet<Class<?>> registered = new LinkedHashSet<>();
        Collections.addAll(registered,
                open.dolphin.rest.AppoResource.class,
                open.dolphin.rest.ScheduleResource.class,
                open.dolphin.rest.EncounterResource.class,
                open.dolphin.rest.LocalMedicalSummaryResource.class,
                open.dolphin.rest.LocalDiagnosisResource.class,
                open.dolphin.rest.KarteResource.class,
                open.dolphin.rest.KarteRevisionResource.class,
                open.dolphin.rest.ChartRevisionResource.class,
                open.dolphin.rest.LetterResource.class,
                open.dolphin.rest.OrcaPatientApiResource.class,
                open.dolphin.rest.PatientModV2OutpatientResource.class,
                open.dolphin.rest.PatientImagesResource.class,
                open.dolphin.rest.AdminConfigResource.class,
                open.dolphin.rest.AdminAccessResource.class,
                open.dolphin.rest.AdminMasterUpdateResource.class,
                open.dolphin.rest.AdminOrcaConnectionResource.class,
                open.dolphin.rest.AdminOrcaCapabilitiesResource.class,
                open.dolphin.rest.AdminOrcaUserResource.class,
                open.dolphin.rest.AdminOrcaUserLinkResource.class,
                open.dolphin.rest.ReceptionRealtimeStreamResource.class,
                open.dolphin.rest.OperationsHealthResource.class,
                open.dolphin.rest.PvtWorkerHealthResource.class,
                open.dolphin.rest.StampResource.class,
                open.dolphin.rest.SystemResource.class,
                open.dolphin.rest.UserResource.class,
                open.dolphin.rest.SessionAuthResource.class,
                open.dolphin.rest.LogoutResource.class,
                open.dolphin.rest.ChartEventStreamResource.class,
                // Local-only routes live under /api/local/*.
                open.dolphin.rest.orca.LocalChartMedicalResource.class,
                open.dolphin.rest.orca.LocalPatientSearchResource.class,
                open.dolphin.rest.orca.LocalChartSubjectiveResource.class,
                open.dolphin.rest.orca.ChartEditSessionResource.class,
                open.dolphin.rest.orca.LocalEncounterBillingWorkflowResource.class,
                open.dolphin.rest.orca.LocalOrcaMedicalCandidateResource.class,
                open.dolphin.rest.orca.LocalOrderBundleResource.class,
                // LocalPrescriptionOrderResource is read-only cache/projection only.
                open.dolphin.rest.orca.LocalPrescriptionOrderResource.class,
                // All production prescription mutations must stay under /api/local/prescription-orders/authority.
                open.dolphin.rest.orca.PrescriptionAuthorityResource.class,
                // Official routes live under /api/orca/official/* and master-backed reads live under /api/orca/master/*.
                open.dolphin.rest.orca.OrcaLiveDiseaseMasterResource.class,
                open.dolphin.rest.orca.OrcaReportDocumentResource.class,
                open.dolphin.rest.orca.OrcaChartSupportResource.class,
                open.dolphin.rest.orca.OrcaOrderMasterResource.class,
                open.orca.rest.OrcaMasterResource.class,
                open.orca.rest.OrcaMasterReferenceStatusResource.class,
                open.dolphin.rest.orca.OrcaAppointmentResource.class,
                open.dolphin.rest.orca.OrcaVisitResource.class,
                open.dolphin.rest.orca.OrcaPatientBatchResource.class,
                open.dolphin.rest.orca.OrcaPatientSyncResource.class,
                open.dolphin.rest.orca.OrcaPatientSyncStatusResource.class,
                open.dolphin.security.auth.AuthSessionRegistryFilter.class,
                open.dolphin.metrics.RequestMetricsFilter.class,
                open.dolphin.rest.jackson.ResteasyObjectMapperResolver.class,
                open.dolphin.rest.RestExceptionMapper.class,
                open.dolphin.rest.OrcaGatewayExceptionMapper.class);
        return Collections.unmodifiableSet(registered);
    }

    @Override
    public Set<Class<?>> getClasses() {
        return new LinkedHashSet<>(REGISTERED_CLASSES);
    }
}
