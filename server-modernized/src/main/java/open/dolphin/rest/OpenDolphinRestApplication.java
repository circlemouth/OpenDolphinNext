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
public class OpenDolphinRestApplication extends Application {

    private final Set<Class<?>> classes;

    public OpenDolphinRestApplication() {
        LinkedHashSet<Class<?>> registered = new LinkedHashSet<>();
        Collections.addAll(registered,
                open.dolphin.rest.AppoResource.class,
                open.dolphin.rest.KarteResource.class,
                open.dolphin.rest.KarteDocumentWriteResource.class,
                open.dolphin.rest.KarteRevisionResource.class,
                open.dolphin.rest.LetterResource.class,
                open.dolphin.rest.PVTResource.class,
                open.dolphin.rest.OrcaPatientApiResource.class,
                open.dolphin.rest.PatientModV2OutpatientResource.class,
                open.dolphin.rest.PatientModV2OutpatientMockResource.class,
                open.dolphin.rest.PatientImagesResource.class,
                open.dolphin.rest.AdminConfigResource.class,
                open.dolphin.rest.AdminAccessResource.class,
                open.dolphin.rest.AdminAccessPasswordResetResource.class,
                open.dolphin.rest.AdminMasterUpdateResource.class,
                open.dolphin.rest.AdminOrcaConnectionResource.class,
                open.dolphin.rest.AdminOrcaUserResource.class,
                open.dolphin.rest.AdminOrcaUserLinkResource.class,
                open.dolphin.rest.AdminSecurityResource.class,
                open.dolphin.rest.OrcaQueueResource.class,
                open.dolphin.rest.ReceptionRealtimeStreamResource.class,
                open.dolphin.rest.OperationsHealthResource.class,
                open.dolphin.rest.PvtWorkerHealthResource.class,
                open.dolphin.rest.StampResource.class,
                open.dolphin.rest.SystemResource.class,
                open.dolphin.rest.UserResource.class,
                open.dolphin.rest.SessionAuthResource.class,
                open.dolphin.rest.LogoutResource.class,
                open.dolphin.rest.ChartEventStreamResource.class,
                open.dolphin.rest.orca.OrcaMedicalResource.class,
                open.dolphin.rest.orca.OrcaMedicalOutpatientResource.class,
                open.dolphin.rest.orca.OrcaDiseaseResource.class,
                open.dolphin.rest.orca.OrcaOrderBundleResource.class,
                open.dolphin.rest.orca.OrcaPatientResource.class,
                open.dolphin.rest.orca.OrcaPrescriptionOrderResource.class,
                open.dolphin.rest.orca.OrcaReportDocumentResource.class,
                open.dolphin.rest.orca.OrcaSubjectiveResource.class,
                open.dolphin.rest.orca.OrcaMedicalAdministrationResource.class,
                open.dolphin.rest.orca.OrcaChartSupportResource.class,
                open.dolphin.rest.orca.OrcaMedicalModV2Resource.class,
                open.orca.rest.OrcaResource.class,
                open.orca.rest.OrcaFacilityResource.class,
                open.orca.rest.OrcaPatientDiseaseResource.class,
                open.orca.rest.OrcaMasterResource.class,
                open.orca.rest.OrcaMasterReferenceStatusResource.class,
                open.dolphin.orca.rest.OrcaAppointmentResource.class,
                open.dolphin.orca.rest.OrcaVisitResource.class,
                open.dolphin.orca.rest.OrcaPatientLocalSearchResource.class,
                open.dolphin.orca.rest.OrcaPatientBatchResource.class,
                open.dolphin.orca.rest.OrcaPatientSyncResource.class,
                open.dolphin.metrics.RequestMetricsFilter.class,
                open.dolphin.rest.jackson.ResteasyObjectMapperResolver.class,
                open.dolphin.rest.RestExceptionMapper.class,
                open.dolphin.rest.OrcaGatewayExceptionMapper.class);
        classes = Collections.unmodifiableSet(registered);
    }

    @Override
    public Set<Class<?>> getClasses() {
        return classes;
    }
}
