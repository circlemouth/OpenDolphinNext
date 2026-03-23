package open.dolphin.rest.support;

import java.util.ArrayList;
import java.util.List;
import open.dolphin.infomodel.DepartmentModel;
import open.dolphin.infomodel.FacilityModel;
import open.dolphin.infomodel.LicenseModel;
import open.dolphin.infomodel.RoleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.UserMutationRequest;

public final class UserMutationRequestMapper {

    private UserMutationRequestMapper() {
    }

    public static UserModel toModel(UserMutationRequest request) {
        if (request == null) {
            return null;
        }
        UserModel model = new UserModel();
        model.setId(request.getId());
        model.setUserId(request.getUserId());
        model.setPassword(request.getPassword());
        model.setSirName(request.getSirName());
        model.setGivenName(request.getGivenName());
        model.setCommonName(request.getCommonName());
        model.setMemberType(request.getMemberType());
        model.setMemo(request.getMemo());
        model.setRegisteredDate(request.getRegisteredDate());
        model.setEmail(request.getEmail());
        model.setOrcaId(request.getOrcaId());
        model.setUseDrugId(request.getUseDrugId());
        model.setMainMobile(request.getMainMobile());
        model.setSubMobile(request.getSubMobile());

        model.setLicenseModel(toLicense(request.getLicenseModel()));
        model.setDepartmentModel(toDepartment(request.getDepartmentModel()));
        model.setFacilityModel(toFacility(request.getFacilityModel()));
        model.setRoles(toRoles(request.getRoles()));
        return model;
    }

    private static LicenseModel toLicense(UserMutationRequest.LicensePayload payload) {
        if (payload == null) {
            return null;
        }
        LicenseModel model = new LicenseModel();
        model.setLicense(payload.getLicense());
        model.setLicenseDesc(payload.getLicenseDesc());
        model.setLicenseCodeSys(payload.getLicenseCodeSys());
        return model;
    }

    private static DepartmentModel toDepartment(UserMutationRequest.DepartmentPayload payload) {
        if (payload == null) {
            return null;
        }
        DepartmentModel model = new DepartmentModel();
        model.setDepartment(payload.getDepartment());
        model.setDepartmentDesc(payload.getDepartmentDesc());
        model.setDepartmentCodeSys(payload.getDepartmentCodeSys());
        return model;
    }

    private static FacilityModel toFacility(UserMutationRequest.FacilityPayload payload) {
        if (payload == null) {
            return null;
        }
        FacilityModel model = new FacilityModel();
        model.setId(payload.getId());
        model.setFacilityId(payload.getFacilityId());
        model.setFacilityName(payload.getFacilityName());
        model.setZipCode(payload.getZipCode());
        model.setAddress(payload.getAddress() != null ? payload.getAddress() : payload.getAddressDesc());
        model.setTelephone(payload.getTelephone());
        model.setFacsimile(payload.getFacsimile());
        model.setUrl(payload.getUrl());
        return model;
    }

    private static List<RoleModel> toRoles(List<UserMutationRequest.RolePayload> payloads) {
        if (payloads == null) {
            return null;
        }
        List<RoleModel> roles = new ArrayList<>(payloads.size());
        for (UserMutationRequest.RolePayload payload : payloads) {
            RoleModel role = new RoleModel();
            if (payload != null) {
                role.setRole(payload.getRole());
            }
            roles.add(role);
        }
        return roles;
    }
}
