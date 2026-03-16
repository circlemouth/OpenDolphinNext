type ReportMetaOptions = {
  apiResult?: string;
  apiResultMessage?: string;
  informationDate?: string;
  informationTime?: string;
  dataId?: string;
  label?: string;
  omitApiResult?: boolean;
  omitApiResultMessage?: boolean;
  omitDataId?: boolean;
};

const ISO_DATE = '20260113';
const ISO_TIME = '220000';

export const ORCA_ADDITIONAL_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);

export const buildReportBody = (options: ReportMetaOptions) => {
  const apiResult = options.apiResult ?? '0000';
  const apiResultMessage = options.apiResultMessage ?? 'OK';
  const informationDate = options.informationDate ?? ISO_DATE;
  const informationTime = options.informationTime ?? ISO_TIME;
  const dataId = options.dataId ?? 'DATA-DEFAULT';
  const label = options.label ?? 'Report';
  const report: Record<string, unknown> = {
    Information_Date: informationDate,
    Information_Time: informationTime,
    Form_ID: `FORM-${dataId}`,
    Form_Name: label,
  };
  if (!options.omitApiResult) {
    report.Api_Result = apiResult;
  }
  if (!options.omitApiResultMessage) {
    report.Api_Result_Message = apiResultMessage;
  }
  if (!options.omitDataId) {
    report.Data_Id = dataId;
  }
  return { report };
};
