package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import java.lang.reflect.Method;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

class KarteDocumentWriteResourceTest {

    @Test
    void pvtCoupledDocumentRouteIsRemoved() {
        boolean exists = Arrays.stream(KarteDocumentWriteResource.class.getMethods())
                .filter(method -> method.getName().equals("postDocument"))
                .filter(method -> method.getParameterCount() == 2)
                .filter(method -> method.isAnnotationPresent(POST.class))
                .map(method -> method.getAnnotation(Path.class))
                .anyMatch(path -> path != null && "/document/pvt/{params}".equals(path.value()));

        assertThat(exists).isFalse();
    }

    @Test
    void documentSaveMethodsDoNotExposeEncounterTransitionPath() {
        for (Method method : KarteDocumentWriteResource.class.getMethods()) {
            Path path = method.getAnnotation(Path.class);
            if (path == null) {
                continue;
            }
            assertThat(path.value()).doesNotContain("/document/pvt/");
        }
    }
}
