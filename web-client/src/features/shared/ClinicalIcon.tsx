import acceptCancelIcon from '../../assets/generated-icons/clinical/accept-cancel.png';
import billingSendIcon from '../../assets/generated-icons/clinical/billing-send.png';
import chargeIcon from '../../assets/generated-icons/clinical/charge.png';
import chartHistoryIcon from '../../assets/generated-icons/clinical/chart-history.png';
import chartOpenIcon from '../../assets/generated-icons/clinical/chart-open.png';
import draftClinicalIcon from '../../assets/generated-icons/clinical/draft-clinical.png';
import injectionIcon from '../../assets/generated-icons/clinical/injection.png';
import orcaSendIcon from '../../assets/generated-icons/clinical/orca-send.png';
import patientSearchExistingIcon from '../../assets/generated-icons/clinical/patient-search-existing.png';
import prescriptionIcon from '../../assets/generated-icons/clinical/prescription.png';
import printExportClinicalIcon from '../../assets/generated-icons/clinical/print-export-clinical.png';
import returnReceptionIcon from '../../assets/generated-icons/clinical/return-reception.png';
import testIcon from '../../assets/generated-icons/clinical/test.png';
import treatmentIcon from '../../assets/generated-icons/clinical/treatment.png';

export type ClinicalIconKey =
  | 'accept-cancel'
  | 'billing-send'
  | 'charge'
  | 'chart-history'
  | 'chart-open'
  | 'draft-clinical'
  | 'injection'
  | 'orca-send'
  | 'patient-search-existing'
  | 'prescription'
  | 'print-export-clinical'
  | 'return-reception'
  | 'test'
  | 'treatment';

const clinicalIconSources: Record<ClinicalIconKey, string> = {
  'accept-cancel': acceptCancelIcon,
  'billing-send': billingSendIcon,
  charge: chargeIcon,
  'chart-history': chartHistoryIcon,
  'chart-open': chartOpenIcon,
  'draft-clinical': draftClinicalIcon,
  injection: injectionIcon,
  'orca-send': orcaSendIcon,
  'patient-search-existing': patientSearchExistingIcon,
  prescription: prescriptionIcon,
  'print-export-clinical': printExportClinicalIcon,
  'return-reception': returnReceptionIcon,
  test: testIcon,
  treatment: treatmentIcon,
};

type ClinicalIconProps = {
  icon: ClinicalIconKey;
  className?: string;
};

export function ClinicalIcon({ icon, className }: ClinicalIconProps) {
  return (
    <img
      className={['clinical-icon', className].filter(Boolean).join(' ')}
      src={clinicalIconSources[icon]}
      alt=""
      aria-hidden="true"
      decoding="async"
      loading="lazy"
      width={20}
      height={20}
    />
  );
}
