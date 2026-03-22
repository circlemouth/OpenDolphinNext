package open.dolphin.session;

import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import jakarta.transaction.TransactionSynchronizationRegistry;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.session.framework.SessionOperation;

@Named
@ApplicationScoped
@Transactional
@SessionOperation
public class PatientServiceBean {

    private static final Logger LOGGER = Logger.getLogger(PatientServiceBean.class.getName());
    public static final int DEFAULT_ALL_PATIENT_PAGE_SIZE = 200;
    public static final int MAX_ALL_PATIENT_PAGE_SIZE = 500;

    @PersistenceContext
    private EntityManager em;

    @Inject
    private ChartEventServiceBean eventServiceBean;

    @Resource
    private TransactionSynchronizationRegistry registry;

    private final PatientServiceBeanSupport support = new PatientServiceBeanSupport();

    public enum PatientSearchType {
        NAME,
        KANA,
        PATIENT_ID,
        TELEPHONE,
        ZIPCODE
    }

    public List<PatientModel> getPatientsByName(String fid, String name) {
        return searchPatients(fid, PatientSearchType.NAME, name);
    }

    public List<PatientModel> getPatientsByKana(String fid, String name) {
        return searchPatients(fid, PatientSearchType.KANA, name);
    }

    public List<PatientModel> getPatientsByDigit(String fid, String digit) {
        return searchPatients(fid, PatientSearchType.PATIENT_ID, digit);
    }

    public List<PatientModel> getPatientsByTelephone(String fid, String number) {
        return searchPatients(fid, PatientSearchType.TELEPHONE, number);
    }

    public List<PatientModel> getPatientsByZipCode(String fid, String zipCode) {
        return searchPatients(fid, PatientSearchType.ZIPCODE, zipCode);
    }

    public List<PatientModel> searchPatients(String fid, PatientSearchType searchType, String keyword) {
        if (fid == null || fid.isBlank() || searchType == null || keyword == null || keyword.isBlank()) {
            return List.of();
        }

        List<PatientModel> ret = switch (searchType) {
            case NAME -> searchPatientsByPrefixQuery("from PatientModel p where p.facilityId=:fid and p.fullName like :name", "name", fid, keyword);
            case KANA -> searchPatientsByPrefixQuery("from PatientModel p where p.facilityId=:fid and p.kanaName like :name", "name", fid, keyword);
            case PATIENT_ID -> searchPatientsByPrefixQuery("from PatientModel p where p.facilityId=:fid and p.patientId like :pid", "pid", fid, keyword);
            case TELEPHONE -> searchPatientsByPrefixQuery("from PatientModel p where p.facilityId = :fid and (p.telephone like :number or p.mobilePhone like :number)", "number", fid, keyword);
            case ZIPCODE -> searchPatientsByPrefixQuery("from PatientModel p where p.facilityId = :fid and p.address.zipCode like :zipCode", "zipCode", fid, keyword);
        };

        return finalizePatientSearchResults(fid, ret);
    }

    public List<PatientModel> getPatientsByPvtDate(String fid, String pvtDate) {
        java.time.LocalDate targetDate = open.dolphin.infomodel.ModelUtils.parseDate(pvtDate);
        if (targetDate == null) {
            return List.of();
        }
        List<PatientVisitModel> list = em.createQuery(
                        "from PatientVisitModel p where p.facilityId = :fid and p.pvtDate >= :fromDate and p.pvtDate < :toDate and p.status!=64")
                .setParameter("fid", fid)
                .setParameter("fromDate", targetDate.atStartOfDay())
                .setParameter("toDate", targetDate.plusDays(1).atStartOfDay())
                .getResultList();
        List<PatientModel> ret = new java.util.ArrayList<>();
        for (PatientVisitModel pvt : list) {
            PatientModel patient = pvt.getPatientModel();
            ret.add(patient);
            patient.setLastVisitAt(pvt.getPvtDate());
        }
        support.setHealthInsurances(em, ret);
        return ret;
    }

    private List<PatientModel> searchPatientsByPrefixQuery(String query, String parameterName, String fid, String keyword) {
        return em.createQuery(query, PatientModel.class)
                .setParameter("fid", fid)
                .setParameter(parameterName, keyword.trim() + "%")
                .getResultList();
    }

    private List<PatientModel> finalizePatientSearchResults(String fid, List<PatientModel> patients) {
        if (patients == null || patients.isEmpty()) {
            return List.of();
        }

        support.populateHealthInsurances(em, patients);
        support.populatePvtDate(em, fid, patients);
        return patients;
    }

    public PatientModel getPatientById(String fid, String pid) {
        PatientModel bean;
        try {
            bean = (PatientModel) em.createQuery("from PatientModel p where p.facilityId=:fid and p.patientId=:pid")
                    .setParameter("fid", fid)
                    .setParameter("pid", pid)
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }

        support.setHealthInsurances(em, bean);
        return bean;
    }

    public int countPatients(String facilityId) {
        return support.countPatients(em, facilityId);
    }

    public List<String> getAllPatientsWithKana(String facilityId, int firstResult, int maxResult) {
        return support.getAllPatientsWithKana(em, facilityId, firstResult, maxResult);
    }

    public List<PatientModel> getTmpKarte(String facilityId) {
        return support.getTmpKarte(em, facilityId);
    }

    public long addPatient(PatientModel patient) {
        return support.addPatient(em, patient);
    }

    public SyncPatientUpsertResult upsertPatientsForSync(String fid, List<PatientModel> patients) {
        return support.upsertPatientsForSync(em, fid, patients);
    }

    public int updateForFacility(String fid, PatientModel patient) {
        return support.updateForFacility(em, fid, patient, merged -> {
            updatePvtList(merged);
            return 1;
        });
    }

    @Deprecated
    public int update(PatientModel patient) {
        return patient == null ? 0 : updateForFacility(patient.getFacilityId(), patient);
    }

    private open.dolphin.infomodel.KarteBean ensureKarte(PatientModel patient) {
        return support.ensureKarte(em, patient);
    }

    public open.dolphin.infomodel.KarteBean ensureKarteByPatientPk(long patientPk) {
        return support.ensureKarteByPatientPk(em, patientPk);
    }

    public List<PatientModel> getPatientList(String fid, List<String> idList) {
        return support.getPatientList(em, fid, idList);
    }

    protected void setHealthInsurances(List<PatientModel> list) {
        support.setHealthInsurances(em, list);
    }

    protected void setHealthInsurances(PatientModel pm) {
        support.setHealthInsurances(em, pm);
    }

    protected List<HealthInsuranceModel> getHealthInsurances(long pk) {
        return support.getHealthInsurances(em, pk);
    }

    public Long getPatientCount(String facilityId, String patientId) {
        return support.getPatientCount(em, facilityId, patientId);
    }

    public List<PatientModel> getAllPatient(String fid) {
        return support.getAllPatient(em, fid, 0, DEFAULT_ALL_PATIENT_PAGE_SIZE);
    }

    public List<PatientModel> getAllPatient(String fid, int offset, int limit) {
        return support.getAllPatient(em, fid, offset, limit);
    }

    public static int normalizePatientPageOffset(int offset) {
        return PatientServiceBeanSupport.normalizePatientPageOffset(offset);
    }

    public static int normalizePatientPageSize(int limit) {
        return PatientServiceBeanSupport.normalizePatientPageSize(limit);
    }

    public record SyncPatientUpsertResult(int createdCount, int updatedCount) {
    }

    public List<PatientModel> getCustom(String fid, String param) {
        return support.getCustom(em, fid, param);
    }

    // legacy hooks kept for subclasses/tests
    protected void updatePvtList(PatientModel pm) {
        if (pm != null) {
            support.updatePvtList(em, eventServiceBean, registry, List.of(pm));
        }
    }
}
