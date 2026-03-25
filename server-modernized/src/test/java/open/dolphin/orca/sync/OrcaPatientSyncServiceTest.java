package open.dolphin.orca.sync;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSyncRequest;
import org.junit.jupiter.api.Test;

class OrcaPatientSyncServiceTest {

    @Test
    void importPatientsDelegatesToImportService() {
        OrcaPatientImportService importService = mock(OrcaPatientImportService.class);
        OrcaPatientSyncRunner syncRunner = mock(OrcaPatientSyncRunner.class);
        OrcaPatientSyncService service = new OrcaPatientSyncService(importService, syncRunner);

        PatientImportRequest request = new PatientImportRequest();
        request.getPatientIds().add("000001");
        PatientImportResponse expected = new PatientImportResponse();
        expected.setApiResult("00");
        when(importService.importPatients(eq("F001"), any(PatientImportRequest.class), eq("RUN-1"))).thenReturn(expected);

        PatientImportResponse actual = service.importPatients("F001", request, "RUN-1");

        assertSame(expected, actual);
        verify(importService).importPatients(eq("F001"), any(PatientImportRequest.class), eq("RUN-1"));
    }

    @Test
    void syncPatientsDelegatesToRunnerWithApiTrigger() {
        OrcaPatientImportService importService = mock(OrcaPatientImportService.class);
        OrcaPatientSyncRunner syncRunner = mock(OrcaPatientSyncRunner.class);
        OrcaPatientSyncService service = new OrcaPatientSyncService(importService, syncRunner);

        PatientSyncRequest request = new PatientSyncRequest();
        PatientImportResponse expected = new PatientImportResponse();
        expected.setApiResult("00");
        when(syncRunner.run(eq("F001"), any(PatientSyncRequest.class), eq("api"), eq("RUN-2"))).thenReturn(expected);

        PatientImportResponse actual = service.syncPatients("F001", request, "RUN-2");

        assertSame(expected, actual);
        verify(syncRunner).run(eq("F001"), any(PatientSyncRequest.class), eq("api"), eq("RUN-2"));
    }
}
