package open.dolphin.session;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import open.dolphin.infomodel.AppointmentModel;
import open.dolphin.infomodel.ChartEventModel;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.mbean.ServletContextHolder;

final class PVTServiceBeanSupport {

    int addPvt(EntityManager em, ChartEventServiceBean eventServiceBean, ServletContextHolder contextHolder, PatientVisitModel pvt) {
        eventServiceBean.ensureInitialized();
        String fid = prepareIncomingPvt(pvt);
        synchronizePatientAndAttach(em, fid, pvt);
        pvt.setPvtDate(PVTServiceBean.normalizePvtDateForStorage(pvt.getPvtDate()));
        return registerVisit(em, eventServiceBean, contextHolder, fid, pvt);
    }

    private String prepareIncomingPvt(PatientVisitModel pvt) {
        String fid = pvt.getFacilityId();
        PatientModel patient = pvt.getPatientModel();
        pvt.setFacilityId(fid);
        patient.setFacilityId(fid);
        StringBuilder sb = new StringBuilder();
        sb.append(pvt.getDeptName()).append(",");
        sb.append(pvt.getDeptCode()).append(",");
        sb.append(pvt.getDoctorName()).append(",");
        sb.append(pvt.getDoctorId()).append(",");
        sb.append(pvt.getJmariNumber()).append(",");
        pvt.setDepartment(sb.toString());
        return fid;
    }

    private void synchronizePatientAndAttach(EntityManager em, String fid, PatientVisitModel pvt) {
        PatientModel patient = pvt.getPatientModel();
        try {
            PatientModel exist = findExistingPatient(em, fid, patient.getPatientId());
            mergePatientState(em, exist, patient);
            em.merge(exist);
            pvt.setPatientModel(exist);
        } catch (NoResultException e) {
            persistNewPatientAndKarte(em, patient);
        }
    }

    private PatientModel findExistingPatient(EntityManager em, String fid, String patientId) {
        return (PatientModel) em.createQuery("from PatientModel p where p.facilityId=:fid and p.patientId=:pid")
                .setParameter("fid", fid)
                .setParameter("pid", patientId)
                .getSingleResult();
    }

    private void mergePatientState(EntityManager em, PatientModel exist, PatientModel incoming) {
        mergePatientInsurances(em, exist, incoming.getHealthInsurances());
        copyPatientProfile(exist, incoming);
    }

    private void mergePatientInsurances(EntityManager em, PatientModel exist, List<HealthInsuranceModel> incomingInsurances) {
        @SuppressWarnings("unchecked")
        List<HealthInsuranceModel> old = em.createQuery("from HealthInsuranceModel h where h.patient.id=:id")
                .setParameter("id", exist.getId())
                .getResultList();
        if (incomingInsurances != null && !incomingInsurances.isEmpty()) {
            PVTServiceBean.InsuranceMergeResult mergeResult = PVTServiceBean.mergeInsurances(old, incomingInsurances);
            for (PVTServiceBean.InsuranceUpdate update : mergeResult.updates()) {
                HealthInsuranceModel persisted = update.persisted();
                HealthInsuranceModel incoming = update.incoming();
                persisted.setBeanJson(incoming.getBeanJson());
                persisted.setPatient(exist);
            }
            for (HealthInsuranceModel model : mergeResult.additions()) {
                model.setPatient(exist);
                em.persist(model);
            }
            exist.setHealthInsurances(mergeResult.merged());
            return;
        }
        exist.setHealthInsurances(old);
    }

    private void copyPatientProfile(PatientModel exist, PatientModel incoming) {
        exist.setFamilyName(incoming.getFamilyName());
        exist.setGivenName(incoming.getGivenName());
        exist.setFullName(incoming.getFullName());
        exist.setKanaFamilyName(incoming.getKanaFamilyName());
        exist.setKanaGivenName(incoming.getKanaGivenName());
        exist.setKanaName(incoming.getKanaName());
        exist.setGender(incoming.getGender());
        exist.setGenderDesc(incoming.getGenderDesc());
        exist.setGenderCodeSys(incoming.getGenderCodeSys());
        exist.setBirthday(incoming.getBirthday());
        exist.setSimpleAddressModel(incoming.getSimpleAddressModel());
        exist.setTelephone(incoming.getTelephone());
        exist.setAppMemo(incoming.getAppMemo());
    }

    private void persistNewPatientAndKarte(EntityManager em, PatientModel patient) {
        em.persist(patient);
        KarteBean karte = new KarteBean();
        karte.setPatientModel(patient);
        karte.setCreated(new Date());
        em.persist(karte);
    }

    private int registerVisit(EntityManager em, ChartEventServiceBean eventServiceBean, ServletContextHolder contextHolder,
            String fid, PatientVisitModel pvt) {
        if (pvt.getPvtDate() == null) {
            return 0;
        }
        if (!isToday(pvt.getPvtDate())) {
            return registerScheduledVisit(em, fid, pvt);
        }
        return registerTodayVisit(em, eventServiceBean, contextHolder, fid, pvt);
    }

    private int registerScheduledVisit(EntityManager em, String fid, PatientVisitModel pvt) {
        LocalDate visitDate = PVTServiceBean.extractPvtDatePart(pvt.getPvtDate());
        if (visitDate == null) {
            return 0;
        }
        @SuppressWarnings("unchecked")
        List<PatientVisitModel> list = em.createQuery("from PatientVisitModel p where p.facilityId=:fid and p.pvtDate >= :fromDate and p.pvtDate < :toDate and p.patient.patientId=:pid order by p.id")
                .setParameter("fid", fid)
                .setParameter("fromDate", visitDate.atStartOfDay())
                .setParameter("toDate", visitDate.plusDays(1).atStartOfDay())
                .setParameter("pid", pvt.getPatientId())
                .getResultList();
        if (list.isEmpty()) {
            em.persist(pvt);
            return 1;
        }
        updateScheduledVisit(list.get(0), pvt);
        return 1;
    }

    private void updateScheduledVisit(PatientVisitModel target, PatientVisitModel incoming) {
        target.setDepartment(incoming.getDepartment());
        target.setDeptCode(incoming.getDeptCode());
        target.setDeptName(incoming.getDeptName());
        target.setDoctorId(incoming.getDoctorId());
        target.setDoctorName(incoming.getDoctorName());
        target.setFirstInsurance(incoming.getFirstInsurance());
        target.setInsuranceUid(incoming.getInsuranceUid());
        target.setJmariNumber(incoming.getJmariNumber());
    }

    private int registerTodayVisit(EntityManager em, ChartEventServiceBean eventServiceBean, ServletContextHolder contextHolder,
            String fid, PatientVisitModel pvt) {
        long karteId = findKarteId(em, pvt);
        applyTodayAppointment(em, contextHolder, pvt, karteId);
        PatientVisitModel existingToday = findActiveVisitByFacilityPatientAndPvtDate(em, fid, pvt.getPatientId(), pvt.getPvtDate());
        if (existingToday != null) {
            mergeTodayVisit(em, contextHolder, eventServiceBean, fid, existingToday, pvt);
            return 0;
        }
        persistTodayVisit(em, eventServiceBean, contextHolder, fid, pvt, karteId);
        return 1;
    }

    private long findKarteId(EntityManager em, PatientVisitModel pvt) {
        return (Long) em.createQuery("select k.id from KarteBean k where k.patient.id = :id")
                .setParameter("id", pvt.getPatientModel().getId())
                .getSingleResult();
    }

    private void applyTodayAppointment(EntityManager em, ServletContextHolder contextHolder, PatientVisitModel pvt, long karteId) {
        @SuppressWarnings("unchecked")
        List<AppointmentModel> appointments = em.createQuery("from AppointmentModel a where a.karte.id=:id and a.date=:date")
                .setParameter("id", karteId)
                .setParameter("date", contextHolder.getToday().getTime())
                .getResultList();
        if (appointments != null && !appointments.isEmpty()) {
            pvt.setAppointment(appointments.get(0).getName());
        }
    }

    private void persistTodayVisit(EntityManager em, ChartEventServiceBean eventServiceBean, ServletContextHolder contextHolder,
            String fid, PatientVisitModel pvt, long karteId) {
        eventServiceBean.setByomeiCount(karteId, pvt);
        em.persist(pvt);
        contextHolder.addPvt(fid, pvt);
        notifyPvtEvent(eventServiceBean, contextHolder, pvt, ChartEventModel.PVT_ADD);
    }

    private boolean isToday(LocalDateTime pvtDate) {
        LocalDate test = PVTServiceBean.extractPvtDatePart(pvtDate);
        return test != null && test.equals(LocalDate.now());
    }

    private PatientVisitModel findActiveVisitByFacilityPatientAndPvtDate(EntityManager em, String fid, String patientId,
            LocalDateTime pvtDate) {
        if (fid == null || fid.isBlank() || patientId == null || patientId.isBlank() || pvtDate == null) {
            return null;
        }
        @SuppressWarnings("unchecked")
        List<PatientVisitModel> matches = em.createQuery("from PatientVisitModel p where p.facilityId=:fid and p.pvtDate=:pvtDate and p.patient.patientId=:pid order by p.id")
                .setParameter("fid", fid)
                .setParameter("pid", patientId)
                .setParameter("pvtDate", pvtDate)
                .getResultList();
        for (PatientVisitModel model : matches) {
            if (!model.getStateBit(PatientVisitModel.BIT_CANCEL)) {
                return model;
            }
        }
        return null;
    }

    private void mergeTodayVisit(EntityManager em, ServletContextHolder contextHolder, ChartEventServiceBean eventServiceBean,
            String fid, PatientVisitModel existingToday, PatientVisitModel incoming) {
        List<PatientVisitModel> pvtList = contextHolder.getPvtList(fid);
        PatientVisitModel cached = findCachedVisitById(pvtList, existingToday.getId());
        PatientVisitModel source = cached != null ? cached : existingToday;
        incoming.setId(existingToday.getId());
        incoming.setState(existingToday.getState());
        incoming.getPatientModel().setOwnerUUID(resolveOwnerUuid(source, existingToday));
        incoming.setByomeiCount(source.getByomeiCount());
        incoming.setByomeiCountToday(source.getByomeiCountToday());
        em.merge(incoming);
        contextHolder.replaceOrAddPvt(fid, incoming);
        notifyPvtEvent(eventServiceBean, contextHolder, incoming, ChartEventModel.PVT_MERGE);
    }

    private PatientVisitModel findCachedVisitById(List<PatientVisitModel> pvtList, long pvtId) {
        if (pvtList == null) {
            return null;
        }
        for (PatientVisitModel model : pvtList) {
            if (model.getId() == pvtId) {
                return model;
            }
        }
        return null;
    }

    private String resolveOwnerUuid(PatientVisitModel primary, PatientVisitModel fallback) {
        if (primary != null && primary.getPatientModel() != null && primary.getPatientModel().getOwnerUUID() != null) {
            return primary.getPatientModel().getOwnerUUID();
        }
        if (fallback != null && fallback.getPatientModel() != null) {
            return fallback.getPatientModel().getOwnerUUID();
        }
        return null;
    }

    private void notifyPvtEvent(ChartEventServiceBean eventServiceBean, ServletContextHolder contextHolder,
            PatientVisitModel pvt, int eventType) {
        String uuid = contextHolder.getServerUUID();
        ChartEventModel msg = new ChartEventModel(uuid);
        msg.setParamFromPvt(pvt);
        msg.setPatientVisitModel(pvt);
        msg.setEventType(eventType);
        eventServiceBean.notifyEvent(msg);
    }
}
