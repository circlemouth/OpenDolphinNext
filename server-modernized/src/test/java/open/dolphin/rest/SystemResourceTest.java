package open.dolphin.rest;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.WebApplicationException;
import java.io.IOException;
import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import open.dolphin.infomodel.ActivityModel;
import open.dolphin.infomodel.RoleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.ActivitySummaryResponse;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.AccountSummary;
import open.dolphin.session.SystemServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;
import open.dolphin.system.license.LicenseRepository;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SystemResourceTest extends RuntimeDelegateTestSupport {

    private static final String REMOTE_USER = "F001:manager01";
    private static final String REQUEST_ID = "req-001";
    private static final String LICENSE_SCOPE = "dolphin";

    @Mock
    private SystemServiceBean systemServiceBean;

    @Mock
    private UserServiceBean userServiceBean;

    @Mock
    private AuditTrailService auditTrailService;

    @Mock
    private SessionTraceManager sessionTraceManager;

    @Mock
    private HttpServletRequest httpServletRequest;

    @Captor
    private ArgumentCaptor<AuditEventPayload> auditCaptor;

    private SystemResource resource;

    private InMemoryLicenseRepository licenseRepository;

    @BeforeEach
    void setUp() throws Exception {
        resource = new SystemResource();
        licenseRepository = new InMemoryLicenseRepository();

        setField(resource, "systemServiceBean", systemServiceBean);
        setField(resource, "userServiceBean", userServiceBean);
        setField(resource, "auditTrailService", auditTrailService);
        setField(resource, "sessionTraceManager", sessionTraceManager);
        setField(resource, "httpServletRequest", httpServletRequest);
        setField(resource, "licenseRepository", licenseRepository);

        when(httpServletRequest.getRemoteUser()).thenReturn(REMOTE_USER);
        when(httpServletRequest.getRemoteAddr()).thenReturn("192.0.2.10");
        when(httpServletRequest.getHeader("User-Agent")).thenReturn("JUnit");
        when(httpServletRequest.getHeader("X-Request-Id")).thenReturn(REQUEST_ID);
        when(httpServletRequest.isUserInRole("ADMIN")).thenReturn(true);
        when(userServiceBean.isSystemAdmin(REMOTE_USER)).thenReturn(true);
        SessionTraceContext trace = new SessionTraceContext("trace-system", Instant.now(), "SYSTEM_OPERATION", Map.of());
        when(sessionTraceManager.current()).thenReturn(trace);
    }

    @Test
    void hellowDolphin_returnsGreeting() {
        String greeting = resource.hellowDolphin();

        assertThat(greeting).isEqualTo("Hellow, Dolphin");
        verifyNoInteractions(auditTrailService, systemServiceBean);
    }

    @Test
    void addFacilityAdmin_rejectsWhenRemoteUserIsMissing() {
        when(httpServletRequest.getRemoteUser()).thenReturn(null);
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin");

        assertThatThrownBy(() -> resource.addFacilityAdmin("{\"userId\":\"manager01\"}"))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(401));

        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("deniedReason")).isEqualTo("remote_user_missing");
    }

    @Test
    void addFacilityAdmin_rejectsWhenUserIsOnlyAdmin() {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin");
        when(userServiceBean.isAdmin(REMOTE_USER)).thenReturn(true);
        when(userServiceBean.isSystemAdmin(REMOTE_USER)).thenReturn(false);

        assertThatThrownBy(() -> resource.addFacilityAdmin("{\"userId\":\"manager01\"}"))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(403));

        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("deniedReason")).isEqualTo("system_admin_privilege_required");
    }

    @Test
    void checkLicense_rejectsWhenUserIsNotSystemAdmin() {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/license");
        when(userServiceBean.isAdmin(REMOTE_USER)).thenReturn(true);
        when(userServiceBean.isSystemAdmin(REMOTE_USER)).thenReturn(false);

        assertThatThrownBy(() -> resource.checkLicense(LICENSE_SCOPE, "XYZ"))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(403));

        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("deniedReason")).isEqualTo("system_admin_privilege_required");
    }

    @Test
    void sendCloudZeroMail_rejectsWhenRemoteUserIsMissing() {
        when(httpServletRequest.getRemoteUser()).thenReturn(null);
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/cloudzero/sendmail");

        assertThatThrownBy(() -> resource.sendCloudZeroMail())
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(401));

        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("deniedReason")).isEqualTo("remote_user_missing");
    }

    @Test
    void sendCloudZeroMail_rejectsWhenUserIsOnlyAdmin() {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/cloudzero/sendmail");
        when(userServiceBean.isAdmin(REMOTE_USER)).thenReturn(true);
        when(userServiceBean.isSystemAdmin(REMOTE_USER)).thenReturn(false);

        assertThatThrownBy(() -> resource.sendCloudZeroMail())
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(403));

        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("deniedReason")).isEqualTo("system_admin_privilege_required");
    }

    @Test
    void sendCloudZeroMail_isExposedAsPostOnly() throws Exception {
        Method method = SystemResource.class.getMethod("sendCloudZeroMail");

        assertThat(method.isAnnotationPresent(POST.class)).isTrue();
        assertThat(method.isAnnotationPresent(GET.class)).isFalse();
    }

    @Test
    void addFacilityAdmin_registersFacilityAdminAndAuditsSuccess() throws Exception {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin");
        AccountSummary summary = new AccountSummary();
        summary.setFacilityId("F001");
        summary.setUserId("F001:manager01");
        when(systemServiceBean.addFacilityAdmin(any())).thenReturn(summary);

        String payload = """
                {
                  "userId":"manager01",
                  "commonName":"管理者",
                  "facilityModel":{"facilityId":"F001"},
                  "roles":[{"role":"ADMIN"}]
                }
                """;

        String result = resource.addFacilityAdmin(payload);

        assertThat(result).isEqualTo("F001:F001:manager01");

        ArgumentCaptor<UserModel> userCaptor = ArgumentCaptor.forClass(UserModel.class);
        verify(systemServiceBean).addFacilityAdmin(userCaptor.capture());
        UserModel captured = userCaptor.getValue();
        assertThat(captured.getRoles()).hasSize(1);
        RoleModel role = captured.getRoles().get(0);
        assertThat(role.getUserModel()).isSameAs(captured);
        assertThat(role.getUserId()).isEqualTo(captured.getUserId());

        verify(auditTrailService).record(auditCaptor.capture());
        AuditEventPayload payloadRecorded = auditCaptor.getValue();
        assertThat(payloadRecorded.getAction()).isEqualTo("SYSTEM_FACILITY_ADMIN_ADD");
        Map<String, Object> details = payloadRecorded.getDetails();
        assertThat(details.get("status")).isEqualTo("success");
        assertThat(details.get("facilityId")).isEqualTo("F001");
        assertThat(details.get("createdUserId")).isEqualTo("F001:manager01");
    }

    @Test
    void addFacilityAdmin_recordsFailureAuditWhenServiceThrows() throws Exception {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin");
        when(systemServiceBean.addFacilityAdmin(any())).thenThrow(new IllegalStateException("duplicate"));

        String payload = """
                {
                  "userId":"manager02",
                  "facilityModel":{"facilityId":"F100"},
                  "roles":[{"role":"CLERK"}]
                }
                """;

        assertThatThrownBy(() -> resource.addFacilityAdmin(payload))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("duplicate");

        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("status")).isEqualTo("failed");
        assertThat(details.get("reason")).isEqualTo("IllegalStateException");
        assertThat(details.get("createdUserId")).isEqualTo("manager02");
    }

    @Test
    void getActivities_aggregatesMonthlyDataAndAudits() {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/activity");
        ActivityModel latest = new ActivityModel();
        latest.setFlag("M");
        ActivityModel previous = new ActivityModel();
        previous.setFlag("M");
        ActivityModel total = new ActivityModel();
        total.setFlag("T");
        when(systemServiceBean.countActivities(eq("F001"), any(Date.class), any(Date.class)))
                .thenReturn(latest, previous);
        when(systemServiceBean.countTotalActivities("F001")).thenReturn(total);

        List<ActivitySummaryResponse> result = resource.getActivities("2025,9,2");

        assertThat(result).hasSize(3);
        assertThat(result.get(2).getFlag()).isEqualTo(total.getFlag());

        verify(systemServiceBean, times(2)).countActivities(eq("F001"), any(Date.class), any(Date.class));
        verify(systemServiceBean).countTotalActivities("F001");
        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("status")).isEqualTo("success");
        assertThat(details.get("facilityId")).isEqualTo("F001");
        assertThat(details.get("monthsRequested")).isEqualTo(2);
    }

    @Test
    void getActivities_invalidParameterThrowsBadRequest() {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/activity");

        assertThatThrownBy(() -> resource.getActivities("2025,XX,2"))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(400));
    }

    @Test
    void sendCloudZeroMail_invokesMonthlyMailerAndAudits() {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/cloudzero/sendmail");

        resource.sendCloudZeroMail();

        LocalDate now = LocalDate.now(ZoneId.systemDefault());
        LocalDate previousMonth = now.minusMonths(1);
        verify(systemServiceBean).sendMonthlyActivities(previousMonth.getYear(), previousMonth.getMonthValue() - 1);
        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("status")).isEqualTo("success");
    }

    @Test
    void sendCloudZeroMail_recordsFailureWhenServiceThrows() {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/cloudzero/sendmail");
        doThrow(new RuntimeException("mail-error"))
                .when(systemServiceBean).sendMonthlyActivities(anyInt(), anyInt());

        assertThatThrownBy(() -> resource.sendCloudZeroMail())
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("mail-error");

        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("status")).isEqualTo("failed");
        assertThat(details.get("reason")).isEqualTo("RuntimeException");
    }

    @Test
    void checkLicense_registersNewUidWhenSlotAvailable() throws IOException {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/license");
        licenseRepository.setProperty("license.max", "2");
        licenseRepository.setProperty("license.uid1", "ABC");

        String result = resource.checkLicense(LICENSE_SCOPE, "XYZ");

        assertThat(result).isEqualTo("0");
        assertThat(licenseRepository.getProperty("license.uid2")).isEqualTo("XYZ");
        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("status")).isEqualTo("success");
        assertThat(details.get("actionType")).isEqualTo("registered");
    }

    @Test
    void checkLicense_returnsSuccessWhenUidAlreadyRegistered() throws IOException {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/license");
        licenseRepository.setProperty("license.max", "2");
        licenseRepository.setProperty("license.uid1", "XYZ");

        String result = resource.checkLicense(LICENSE_SCOPE, "XYZ");

        assertThat(result).isEqualTo("0");
        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("status")).isEqualTo("success");
        assertThat(details.get("actionType")).isEqualTo("already_registered");
    }

    @Test
    void checkLicense_returnsLimitExceededWhenNoSlotAvailable() throws IOException {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/license");
        licenseRepository.setProperty("license.max", "1");
        licenseRepository.setProperty("license.uid1", "A");

        String result = resource.checkLicense(LICENSE_SCOPE, "B");

        assertThat(result).isEqualTo("4");
        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("status")).isEqualTo("failed");
        assertThat(details.get("reason")).isEqualTo("limit_exceeded");
    }

    @Test
    void checkLicense_returnsReadErrorWhenRepositoryFailsToLoad() throws IOException {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/license");
        licenseRepository.failOnLoad();

        String result = resource.checkLicense(LICENSE_SCOPE, "XYZ");

        assertThat(result).isEqualTo("2");
        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("status")).isEqualTo("failed");
        assertThat(details.get("reason")).isEqualTo("read_error");
    }

    @Test
    void checkLicense_returnsWriteErrorWhenRepositoryFailsToStore() throws IOException {
        when(httpServletRequest.getRequestURI()).thenReturn("/dolphin/license");
        licenseRepository.setProperty("license.max", "2");
        licenseRepository.failOnStore();

        String result = resource.checkLicense(LICENSE_SCOPE, "XYZ");

        assertThat(result).isEqualTo("3");
        verify(auditTrailService).record(auditCaptor.capture());
        Map<String, Object> details = auditCaptor.getValue().getDetails();
        assertThat(details.get("status")).isEqualTo("failed");
        assertThat(details.get("reason")).isEqualTo("write_error");
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        var field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static class InMemoryLicenseRepository implements LicenseRepository {

        private Properties properties = new Properties();
        private boolean failOnLoad;
        private boolean failOnStore;

        void setProperty(String key, String value) {
            properties.setProperty(key, value);
        }

        String getProperty(String key) {
            return properties.getProperty(key);
        }

        void failOnLoad() {
            this.failOnLoad = true;
        }

        void failOnStore() {
            this.failOnStore = true;
        }

        @Override
        public Properties load() throws IOException {
            if (failOnLoad) {
                throw new IOException("load failed");
            }
            Properties copy = new Properties();
            copy.putAll(this.properties);
            return copy;
        }

        @Override
        public void store(Properties properties) throws IOException {
            if (failOnStore) {
                throw new IOException("store failed");
            }
            Properties copy = new Properties();
            copy.putAll(properties);
            this.properties = copy;
        }
    }
}
