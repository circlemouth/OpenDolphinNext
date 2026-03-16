import { outpatientHandlers } from './outpatient';
import { orcaQueueHandlers } from './orcaQueue';
import { orcaIncomeHandlers } from './orcaIncome';
import { orcaReportHandlers } from './orcaReport';
import { orcaClaimHandlers } from './orcaClaim';
import { orcaReceptionHandlers } from './orcaReception';
import { orcaMasterHandlers } from './orcaMaster';
import { orcaDeptInfoHandlers } from './orcaDeptInfo';
import { orcaDiseaseHandlers } from './orcaDisease';
import { orcaOrderBundleHandlers } from './orcaOrderBundles';
import { orcaOrderSupportHandlers } from './orcaOrderSupport';
import { stampTreeHandlers } from './stampTree';
import { karteImageHandlers } from './karteImage';
import { chartEventHandlers } from './chartEvents';
import { patientImagesHandlers } from './patientImages';

export const handlers = [
  ...outpatientHandlers,
  ...orcaQueueHandlers,
  ...orcaIncomeHandlers,
  ...orcaReportHandlers,
  ...orcaClaimHandlers,
  ...orcaReceptionHandlers,
  ...orcaMasterHandlers,
  ...orcaDeptInfoHandlers,
  ...orcaDiseaseHandlers,
  ...orcaOrderBundleHandlers,
  ...orcaOrderSupportHandlers,
  ...stampTreeHandlers,
  ...karteImageHandlers,
  ...patientImagesHandlers,
  ...chartEventHandlers,
];
