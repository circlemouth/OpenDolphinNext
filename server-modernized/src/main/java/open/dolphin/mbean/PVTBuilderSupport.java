package open.dolphin.mbean;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Collection;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.List;
import java.util.logging.Logger;
import open.dolphin.infomodel.AddressModel;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PVTClaim;
import open.dolphin.infomodel.PVTHealthInsuranceModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.infomodel.PVTPublicInsuranceItemModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.infomodel.TelephoneModel;
import org.jdom.Attribute;
import org.jdom.Element;
import org.jdom.Namespace;

final class PVTBuilderSupport {

    private static final Namespace MML_HI = Namespace.getNamespace("mmlHi", "http://www.medxml.net/MML/ContentModule/HealthInsurance/1.1");

    private static final char FULL_SPACE = '　';
    private static final char HALF_SPACE = ' ';

    private PVTBuilderSupport() {
    }

    static PatientVisitModel buildProduct(
            PatientModel patientModel,
            List<PVTHealthInsuranceModel> pvtInsurances,
            PVTClaim pvtClaim,
            Logger logger) {
        PatientVisitModel model = new PatientVisitModel();
        enrichPatientModel(patientModel, pvtInsurances);
        if (patientModel != null) {
            model.setPatientModel(patientModel);
        }
        if (!applyClaim(model, pvtClaim, pvtInsurances, logger)) {
            return null;
        }
        return model;
    }

    static void parsePatientInfo(PatientModel patientModel, Element docInfo, Element content, boolean debug, Logger logger) {
        if (patientModel == null || content == null) {
            return;
        }
        parsePatientInfoElements(patientModel, docInfo, content.getChildren(), debug, logger);
    }

    static void parseHealthInsurance(PVTHealthInsuranceModel curInsurance, Element docInfo, Element content, boolean debug, Logger logger) {
        if (curInsurance == null || content == null) {
            return;
        }
        Element hModule = content.getChild("HealthInsuranceModule", MML_HI);
        if (hModule == null) {
            logger.warning("HealthInsuranceModule element not found");
            return;
        }
        applyInsuranceBaseFields(curInsurance, hModule, debug, logger);
        applyPublicInsurance(curInsurance, hModule, debug, logger);
    }

    private static void enrichPatientModel(PatientModel patientModel, List<PVTHealthInsuranceModel> pvtInsurances) {
        if (patientModel == null) {
            return;
        }
        normalizePatientNames(patientModel);
        normalizeAddress(patientModel);
        copyTelephones(patientModel);
        copyInsurances(patientModel, pvtInsurances);
    }

    private static void normalizePatientNames(PatientModel patientModel) {
        String fullName = patientModel.getFullName();
        if (fullName != null) {
            fullName = fullName.replace(FULL_SPACE, HALF_SPACE);
            patientModel.setFullName(fullName);
            int index = fullName.indexOf(HALF_SPACE);
            if (patientModel.getFamilyName() == null && index > 0) {
                patientModel.setFamilyName(fullName.substring(0, index));
            }
            if (patientModel.getGivenName() == null && index > 0) {
                patientModel.setGivenName(fullName.substring(index + 1));
            }
        }
        String kana = patientModel.getKanaName();
        if (kana != null) {
            kana = kana.replace(FULL_SPACE, HALF_SPACE);
            patientModel.setKanaName(kana);
            int index = kana.indexOf(HALF_SPACE);
            if (patientModel.getKanaFamilyName() == null && index > 0) {
                patientModel.setKanaFamilyName(kana.substring(0, index));
            }
            if (patientModel.getKanaGivenName() == null && index > 0) {
                patientModel.setKanaGivenName(kana.substring(index + 1));
            }
        }
    }

    private static void normalizeAddress(PatientModel patientModel) {
        Collection<AddressModel> addresses = patientModel.getAddresses();
        if (addresses == null || addresses.isEmpty()) {
            return;
        }
        for (AddressModel bean : addresses) {
            String addr = bean.getAddress().replace(FULL_SPACE, HALF_SPACE);
            addr = addr.replace('ー', '-');
            SimpleAddressModel simple = new SimpleAddressModel();
            simple.setZipCode(bean.getZipCode());
            simple.setAddress(addr);
            patientModel.setSimpleAddressModel(simple);
            break;
        }
    }

    private static void copyTelephones(PatientModel patientModel) {
        Collection<TelephoneModel> telephones = patientModel.getTelephones();
        if (telephones == null) {
            return;
        }
        for (TelephoneModel bean : telephones) {
            patientModel.setTelephone(bean.getMemo());
        }
    }

    private static void copyInsurances(PatientModel patientModel, List<PVTHealthInsuranceModel> pvtInsurances) {
        if (pvtInsurances == null || pvtInsurances.isEmpty()) {
            return;
        }
        for (PVTHealthInsuranceModel bean : pvtInsurances) {
            HealthInsuranceModel insModel = new HealthInsuranceModel();
            insModel.setBeanJson(ModelUtils.jsonEncode(bean));
            patientModel.addHealthInsurance(insModel);
            insModel.setPatient(patientModel);
        }
    }

    private static boolean applyClaim(
            PatientVisitModel model,
            PVTClaim pvtClaim,
            List<PVTHealthInsuranceModel> pvtInsurances,
            Logger logger) {
        if (pvtClaim == null) {
            return true;
        }
        if (pvtClaim.getClaimStatus() != null && pvtClaim.getClaimStatus().trim().equals("regist")) {
            logger.info("受付登録情報受信");
        } else {
            logger.info("受付登録ではないため受信した情報を破棄");
            return false;
        }
        model.setDeptCode(pvtClaim.getClaimDeptCode());
        model.setDeptName(pvtClaim.getClaimDeptName());
        model.setDoctorId(pvtClaim.getAssignedDoctorId());
        model.setDoctorName(pvtClaim.getAssignedDoctorName());
        model.setJmariNumber(pvtClaim.getJmariCode());
        String registTime = pvtClaim.getClaimRegistTime();
        if (isAfterToday(registTime)) {
            model.setPvtDate(ModelUtils.parseDateTime(dateAsSchedule(registTime)));
        } else {
            model.setPvtDate(ModelUtils.parseDateTime(registTime));
        }
        model.setInsuranceUid(pvtClaim.getInsuranceUid());
        if (pvtInsurances != null && !pvtInsurances.isEmpty()) {
            model.setFirstInsurance(pvtInsurances.get(0).toString());
        }
        return true;
    }

    private static void parsePatientInfoElements(
            PatientModel patientModel,
            Element docInfo,
            List<Element> children,
            boolean debug,
            Logger logger) {
        String curRepCode = null;
        AddressModel curAddress = null;
        TelephoneModel curTelephone = null;
        for (Element child : children) {
            String qname = child.getQualifiedName();
            if ("mmlCm:Id".equals(qname)) {
                patientModel.setPatientId(child.getTextTrim());
                if (debug) {
                    logger.fine("Parsed patient identifier");
                }
            } else if ("mmlNm:Name".equals(qname)) {
                curRepCode = resolveRepCode(child, debug, logger);
            } else if ("mmlNm:family".equals(qname)) {
                applyFamilyName(patientModel, curRepCode, child.getTextTrim(), debug, logger);
            } else if ("mmlNm:given".equals(qname)) {
                applyGivenName(patientModel, curRepCode, child.getTextTrim(), debug, logger);
            } else if ("mmlNm:fullname".equals(qname)) {
                applyFullName(patientModel, curRepCode, child.getTextTrim(), debug, logger);
            } else if ("mmlPi:birthday".equals(qname)) {
                patientModel.setBirthday(ModelUtils.parseDate(child.getTextTrim()));
                if (debug) {
                    logger.fine("Parsed birthday element");
                }
            } else if ("mmlPi:sex".equals(qname)) {
                patientModel.setGender(child.getTextTrim());
                if (debug) {
                    logger.fine("Parsed gender element");
                }
            } else if ("mmlAd:Address".equals(qname)) {
                curAddress = new AddressModel();
                patientModel.addAddress(curAddress);
                curRepCode = resolveAddressMetadata(curAddress, child, debug, logger);
            } else if ("mmlAd:full".equals(qname) && curAddress != null) {
                curAddress.setAddress(child.getTextTrim());
                if (debug) {
                    logger.fine("Parsed address element");
                }
            } else if ("mmlAd:zip".equals(qname) && curAddress != null) {
                curAddress.setZipCode(child.getTextTrim());
                if (debug) {
                    logger.fine("Parsed zip element");
                }
            } else if ("mmlPh:Phone".equals(qname)) {
                curTelephone = new TelephoneModel();
                patientModel.addTelephone(curTelephone);
            } else if ("mmlPh:area".equals(qname) && curTelephone != null) {
                curTelephone.setArea(child.getTextTrim());
                if (debug) {
                    logger.fine("Parsed phone area element");
                }
            } else if ("mmlPh:city".equals(qname) && curTelephone != null) {
                curTelephone.setCity(child.getTextTrim());
                if (debug) {
                    logger.fine("Parsed phone city element");
                }
            } else if ("mmlPh:number".equals(qname) && curTelephone != null) {
                curTelephone.setNumber(child.getTextTrim());
                if (debug) {
                    logger.fine("Parsed phone number element");
                }
            } else if ("mmlPh:memo".equals(qname) && curTelephone != null) {
                curTelephone.setMemo(child.getTextTrim());
                if (debug) {
                    logger.fine("Parsed phone memo element");
                }
            }
            parsePatientInfoElements(patientModel, docInfo, child.getChildren(), debug, logger);
        }
    }

    private static String resolveRepCode(Element child, boolean debug, Logger logger) {
        String repCode = null;
        for (Object attributeObject : child.getAttributes()) {
            Attribute attr = (Attribute) attributeObject;
            if ("repCode".equals(attr.getName())) {
                repCode = attr.getValue();
                if (debug) {
                    logger.fine("Parsed name representation code");
                }
            } else if ("tableId".equals(attr.getName()) && debug) {
                logger.fine("Parsed name tableId");
            }
        }
        return repCode;
    }

    private static String resolveAddressMetadata(AddressModel curAddress, Element child, boolean debug, Logger logger) {
        String repCode = null;
        for (Object attributeObject : child.getAttributes()) {
            Attribute attr = (Attribute) attributeObject;
            if ("addressClass".equals(attr.getName())) {
                repCode = attr.getValue();
                curAddress.setAddressType(attr.getValue());
                if (debug) {
                    logger.fine("Parsed addressClass");
                }
            } else if ("tableId".equals(attr.getName())) {
                curAddress.setAddressTypeCodeSys(attr.getValue());
                if (debug) {
                    logger.fine("Parsed address tableId");
                }
            }
        }
        return repCode;
    }

    private static void applyFamilyName(PatientModel patientModel, String curRepCode, String value, boolean debug, Logger logger) {
        if ("P".equals(curRepCode)) {
            patientModel.setKanaFamilyName(value);
        } else if ("I".equals(curRepCode)) {
            patientModel.setFamilyName(value);
        } else if ("A".equals(curRepCode)) {
            patientModel.setRomanFamilyName(value);
        }
        if (debug) {
            logger.fine("Parsed family name element");
        }
    }

    private static void applyGivenName(PatientModel patientModel, String curRepCode, String value, boolean debug, Logger logger) {
        if ("P".equals(curRepCode)) {
            patientModel.setKanaGivenName(value);
        } else if ("I".equals(curRepCode)) {
            patientModel.setGivenName(value);
        } else if ("A".equals(curRepCode)) {
            patientModel.setRomanGivenName(value);
        }
        if (debug) {
            logger.fine("Parsed given name element");
        }
    }

    private static void applyFullName(PatientModel patientModel, String curRepCode, String value, boolean debug, Logger logger) {
        if ("P".equals(curRepCode)) {
            patientModel.setKanaName(value);
        } else if ("I".equals(curRepCode)) {
            patientModel.setFullName(value);
        } else if ("A".equals(curRepCode)) {
            patientModel.setRomanName(value);
        }
        if (debug) {
            logger.fine("Parsed full name element");
        }
    }

    private static void applyInsuranceBaseFields(
            PVTHealthInsuranceModel curInsurance,
            Element hModule,
            boolean debug,
            Logger logger) {
        Element insuranceClassEle = hModule.getChild("insuranceClass", MML_HI);
        if (insuranceClassEle != null) {
            curInsurance.setInsuranceClass(insuranceClassEle.getTextTrim());
            if (insuranceClassEle.getAttribute("ClassCode", MML_HI) != null) {
                curInsurance.setInsuranceClassCode(insuranceClassEle.getAttributeValue("ClassCode", MML_HI));
            }
            if (insuranceClassEle.getAttribute("tableId", MML_HI) != null) {
                curInsurance.setInsuranceClassCodeSys(insuranceClassEle.getAttributeValue("tableId", MML_HI));
            }
        }
        String insuranceNumber = hModule.getChildTextTrim("insuranceNumber", MML_HI);
        if (insuranceNumber != null) {
            curInsurance.setInsuranceNumber(insuranceNumber);
        }
        Element clientIdEle = hModule.getChild("clientId", MML_HI);
        if (clientIdEle != null) {
            if (clientIdEle.getChild("group", MML_HI) != null) {
                curInsurance.setClientGroup(clientIdEle.getChildTextTrim("group", MML_HI));
            }
            if (clientIdEle.getChild("number", MML_HI) != null) {
                curInsurance.setClientNumber(clientIdEle.getChildTextTrim("number", MML_HI));
            }
        }
        if (hModule.getChild("familyClass", MML_HI) != null) {
            curInsurance.setFamilyClass(hModule.getChildTextTrim("familyClass", MML_HI));
        }
        if (hModule.getChild("startDate", MML_HI) != null) {
            curInsurance.setStartDate(hModule.getChildTextTrim("startDate", MML_HI));
        }
        if (hModule.getChild("expiredDate", MML_HI) != null) {
            curInsurance.setExpiredDate(hModule.getChildTextTrim("expiredDate", MML_HI));
        }
        if (hModule.getChild("paymentInRatio", MML_HI) != null) {
            curInsurance.setPayInRatio(hModule.getChildTextTrim("paymentInRatio", MML_HI));
        }
        if (hModule.getChild("paymentOutRatio", MML_HI) != null) {
            curInsurance.setPayOutRatio(hModule.getChildTextTrim("paymentOutRatio", MML_HI));
        }
        if (debug) {
            logger.fine("Parsed base healthInsurance fields");
        }
    }

    private static void applyPublicInsurance(
            PVTHealthInsuranceModel curInsurance,
            Element hModule,
            boolean debug,
            Logger logger) {
        Element publicInsuranceEle = hModule.getChild("publicInsurance", MML_HI);
        if (publicInsuranceEle == null) {
            return;
        }
        for (Object item : publicInsuranceEle.getChildren()) {
            Element publicInsuranceItem = (Element) item;
            PVTPublicInsuranceItemModel curPublicItem = new PVTPublicInsuranceItemModel();
            curInsurance.addPvtPublicInsuranceItem(curPublicItem);
            if (publicInsuranceItem.getAttribute("priority", MML_HI) != null) {
                curPublicItem.setPriority(publicInsuranceItem.getAttributeValue("priority", MML_HI));
            }
            if (publicInsuranceItem.getChild("providerName", MML_HI) != null) {
                curPublicItem.setProviderName(publicInsuranceItem.getChildTextTrim("providerName", MML_HI));
            }
            if (publicInsuranceItem.getChild("provider", MML_HI) != null) {
                curPublicItem.setProvider(publicInsuranceItem.getChildTextTrim("provider", MML_HI));
            }
            if (publicInsuranceItem.getChild("recipient", MML_HI) != null) {
                curPublicItem.setRecipient(publicInsuranceItem.getChildTextTrim("recipient", MML_HI));
            }
            if (publicInsuranceItem.getChild("startDate", MML_HI) != null) {
                curPublicItem.setStartDate(publicInsuranceItem.getChildTextTrim("startDate", MML_HI));
            }
            if (publicInsuranceItem.getChild("expiredDate", MML_HI) != null) {
                curPublicItem.setExpiredDate(publicInsuranceItem.getChildTextTrim("expiredDate", MML_HI));
            }
            Element paymentRatioEle = publicInsuranceItem.getChild("paymentRatio", MML_HI);
            if (paymentRatioEle != null) {
                curPublicItem.setPaymentRatio(paymentRatioEle.getTextTrim());
                if (paymentRatioEle.getAttribute("ratioType", MML_HI) != null) {
                    curPublicItem.setPaymentRatioType(paymentRatioEle.getAttributeValue("ratioType", MML_HI));
                }
            }
            if (debug) {
                logger.fine("Parsed public insurance item");
            }
        }
    }

    static boolean isAfterToday(String mmlDate) {
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            Date test = sdf.parse(mmlDate);
            GregorianCalendar gc1 = new GregorianCalendar();
            gc1.setTime(test);
            gc1.clear(java.util.Calendar.HOUR_OF_DAY);
            gc1.clear(java.util.Calendar.MINUTE);
            gc1.clear(java.util.Calendar.SECOND);
            gc1.clear(java.util.Calendar.MILLISECOND);
            GregorianCalendar gc2 = new GregorianCalendar();
            gc2.setTime(new Date());
            gc2.clear(java.util.Calendar.HOUR_OF_DAY);
            gc2.clear(java.util.Calendar.MINUTE);
            gc2.clear(java.util.Calendar.SECOND);
            gc2.clear(java.util.Calendar.MILLISECOND);
            if (gc1.get(java.util.Calendar.YEAR) > gc2.get(java.util.Calendar.YEAR)) {
                return true;
            }
            if (gc1.get(java.util.Calendar.MONTH) > gc2.get(java.util.Calendar.MONTH)) {
                return true;
            }
            return gc1.get(java.util.Calendar.DAY_OF_MONTH) > gc2.get(java.util.Calendar.DAY_OF_MONTH);
        } catch (ParseException ex) {
            return false;
        }
    }

    static String dateAsSchedule(String mmlDate) {
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            Date test = sdf.parse(mmlDate);
            GregorianCalendar gc1 = new GregorianCalendar();
            gc1.setTime(test);
            gc1.set(java.util.Calendar.HOUR_OF_DAY, 0);
            gc1.set(java.util.Calendar.MINUTE, 0);
            gc1.set(java.util.Calendar.SECOND, 0);
            gc1.set(java.util.Calendar.MILLISECOND, 0);
            return sdf.format(gc1.getTime());
        } catch (ParseException ex) {
            return null;
        }
    }
}
