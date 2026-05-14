package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class PrescriptionOrderRepositoryTest {

    @Test
    void saveAlwaysRejectsLegacyAuthorityWriteIntoOrcaProjectionTable() {
        PrescriptionOrderRepository repository = new PrescriptionOrderRepository();

        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> repository.save(
                        "F001",
                        "P001",
                        "ENC-001",
                        LocalDate.parse("2026-05-15"),
                        LocalDate.parse("2026-05-15"),
                        "{}",
                        Instant.parse("2026-05-15T00:00:00Z"),
                        "doctor-1"));

        assertEquals(PrescriptionOrderRepository.PROJECTION_WRITE_DENIED, exception.getMessage());
    }
}
