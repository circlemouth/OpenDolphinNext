package open.dolphin.encounter;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import javax.sql.DataSource;
import open.dolphin.rest.dto.orca.PatientSummary;

@ApplicationScoped
public class ProjectionPatientSummaryRepository {

    private static final String SQL_SELECT = """
            SELECT patientid, fullname, kananame, birthday, gender
              FROM opendolphin.d_patient
             WHERE facilityid = ?
               AND patientid = ?
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    public PatientSummary findByFacilityAndPatientId(String facilityId, String patientId) {
        String normalizedFacilityId = normalize(facilityId);
        String normalizedPatientId = normalize(patientId);
        if (normalizedFacilityId == null || normalizedPatientId == null || dataSource == null) {
            return null;
        }
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT)) {
            statement.setString(1, normalizedFacilityId);
            statement.setString(2, normalizedPatientId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                PatientSummary summary = new PatientSummary();
                summary.setPatientId(resultSet.getString(1));
                summary.setWholeName(resultSet.getString(2));
                summary.setWholeNameKana(resultSet.getString(3));
                summary.setBirthDate(resultSet.getString(4));
                summary.setSex(resultSet.getString(5));
                return summary;
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load patient summary for projection", ex);
        }
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
