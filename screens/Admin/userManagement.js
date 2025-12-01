import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Modal } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Icon from "react-native-vector-icons/Feather";
import Header2 from "../navigation/adminHeader";

const users = [
    {
        id: "1",
        firstName: "Juan",
        lastName: "Santos Dela Cruz",
        email: "juan@farm.com",
        phone: "+63 917 123 4567",
        role: "owner",
        status: "active",
        created: "2025-01-15",
    },
    {
        id: "2",
        firstName: "Maria",
        lastName: "Lopez Santos",
        email: "maria@farm.com",
        phone: "+63 917 123 4567",
        role: "manager",
        status: "active",
        created: "2025-01-15",
    },
    {
        id: "3",
        firstName: "Pedro",
        lastName: "Garcia Lopez",
        email: "pedro@farm.com",
        phone: "+63 917 123 4567",
        role: "worker",
        status: "active",
        created: "2025-01-15",
    },
    {
        id: "4",
        firstName: "Ana",
        lastName: "Cruz Garcia",
        email: "juan@farm.com",
        phone: "+63 917 123 4567",
        role: "worker",
        status: "inactive",
        created: "2025-01-15",
    },
];

const roleColors = {
    owner: "#E3EAFD",
    manager: "#E3EAFD",
    worker: "#E3EAFD",
};
const roleTextColors = {
    owner: "#234187",
    manager: "#234187",
    worker: "#234187",
};

export default function UserManagement({ navigation }) {
    const [search, setSearch] = useState("");
    const [selectedRole, setSelectedRole] = useState("All Roles");
    const [selectedStatus, setSelectedStatus] = useState("All Status");
    const [roleFilterOpen, setRoleFilterOpen] = useState(false);
    const roleFilterOptions = ["All Roles", "Manager", "Owner", "Worker"];

    // NEW: status filter dropdown state and options
    const [statusFilterOpen, setStatusFilterOpen] = useState(false);
    const statusFilterOptions = ["All Status", "Active", "Inactive"];

    const [pressedRow, setPressedRow] = useState(null);
    const [editUser, setEditUser] = useState({
        firstName: "Maria",
        middleName: "Lopez",
        lastName: "Santos",
        email: "maria@farm.com",
        phone: "+63 917 234 5678",
        role: "Manager", // use display format
    });
    const roles = ["Owner", "Manager", "Worker"];
    const [roleOpen, setRoleOpen] = useState(false);
    const [savedVisible, setSavedVisible] = useState(false);
    const [saveBtnPressed, setSaveBtnPressed] = useState(false);
    const [cancelBtnPressed, setCancelBtnPressed] = useState(false);

    // Force Password Change Modal
    const [forcePasswordVisible, setForcePasswordVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [confirmBtnPressed, setConfirmBtnPressed] = useState(false);
    const [cancelPasswordBtnPressed, setCancelPasswordBtnPressed] = useState(false);
    const [passwordResetSuccessVisible, setPasswordResetSuccessVisible] = useState(false);

    // Delete User Modal
    const [deleteUserVisible, setDeleteUserVisible] = useState(false);
    const [deleteConfirmBtnPressed, setDeleteConfirmBtnPressed] = useState(false);
    const [deleteCancelBtnPressed, setDeleteCancelBtnPressed] = useState(false);
    const [deleteSuccessVisible, setDeleteSuccessVisible] = useState(false);

    // Apply filters: role + status + search
    const filteredUsers = users.filter(u => {
        // role filter
        const roleOk =
            selectedRole === "All Roles" ||
            u.role.toLowerCase() === selectedRole.toLowerCase();
        // status filter
        const statusOk =
            selectedStatus === "All Status" ||
            u.status.toLowerCase() === selectedStatus.toLowerCase();
        // search filter (name or email)
        const q = search.trim().toLowerCase();
        const name = `${u.firstName} ${u.lastName}`.toLowerCase();
        const searchOk = q === "" || name.includes(q) || u.email.toLowerCase().includes(q);
        return roleOk && statusOk && searchOk;
    });

    const handleEditUser = (user) => {
        // Navigate to ManageAccount screen with user data
        navigation.navigate("ManageAccount", { userData: user });
    };

    const handleForcePasswordChange = (user) => {
        setSelectedUser(user);
        setForcePasswordVisible(true);
    };

    const handleConfirmPasswordChange = () => {
        console.log("Force password change for:", selectedUser);
        setForcePasswordVisible(false);
        
        // Show success modal
        setPasswordResetSuccessVisible(true);
        
        // Redirect after 2.5 seconds
        setTimeout(() => {
            setPasswordResetSuccessVisible(false);
            setSelectedUser(null);
        }, 2500);
    };

    const handleDeleteUser = (user) => {
        setSelectedUser(user);
        setDeleteUserVisible(true);
    };

    const handleConfirmDelete = () => {
        console.log("Delete user:", selectedUser);
        setDeleteUserVisible(false);
        
        // Show success modal
        setDeleteSuccessVisible(true);
        
        // Redirect after 2.5 seconds
        setTimeout(() => {
            setDeleteSuccessVisible(false);
            setSelectedUser(null);
        }, 2500);
    };

    return (
        <SafeAreaView style={styles.safe}>
            <Header2 />
            <View style={styles.topBarWrapper}>
                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <Icon name="search" size={20} color="#8A99A8" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or email..."
                        placeholderTextColor="#8A99A8"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                {/* Filters */}
                <View style={styles.filtersRow}>
                    {/* Role filter dropdown */}
                    <View style={styles.filterDropdownWrapper}>
                        <TouchableOpacity
                            style={styles.filterButton}
                            onPress={() => { setRoleFilterOpen(o => !o); setStatusFilterOpen(false); }}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="filter-variant" size={18} color="#000" style={{ marginRight: 6 }} />
                            <Text style={styles.filterText}>{selectedRole}</Text>
                            <MaterialCommunityIcons name={roleFilterOpen ? "chevron-up" : "chevron-down"} size={18} color="#000" />
                        </TouchableOpacity>

                        {roleFilterOpen && (
                            <View style={styles.filterDropdown}>
                                {roleFilterOptions.map(opt => (
                                    <TouchableOpacity
                                        key={opt}
                                        style={styles.filterDropdownItem}
                                        onPress={() => {
                                            setSelectedRole(opt);
                                            setRoleFilterOpen(false);
                                        }}
                                    >
                                        <Text style={styles.filterDropdownItemText}>{opt}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Status filter dropdown */}
                    <View style={styles.filterDropdownWrapper}>
                        <TouchableOpacity
                            style={styles.filterButton}
                            onPress={() => { setStatusFilterOpen(o => !o); setRoleFilterOpen(false); }}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="filter-variant" size={18} color="#000" style={{ marginRight: 6 }} />
                            <Text style={styles.filterText}>{selectedStatus}</Text>
                            <MaterialCommunityIcons name={statusFilterOpen ? "chevron-up" : "chevron-down"} size={18} color="#000" />
                        </TouchableOpacity>

                        {statusFilterOpen && (
                            <View style={styles.filterDropdown}>
                                {statusFilterOptions.map(opt => (
                                    <TouchableOpacity
                                        key={opt}
                                        style={styles.filterDropdownItem}
                                        onPress={() => {
                                            setSelectedStatus(opt);
                                            setStatusFilterOpen(false);
                                        }}
                                    >
                                        <Text style={styles.filterDropdownItemText}>{opt}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </View>
            {/* Close any open filter when tapping outside or scrolling */}
            { (roleFilterOpen || statusFilterOpen) && (
                <TouchableOpacity
                    style={styles.fullscreenDismiss}
                    activeOpacity={1}
                    onPress={() => { setRoleFilterOpen(false); setStatusFilterOpen(false); }}
                />
            ) }
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ paddingBottom: 32 }}
                onScrollBeginDrag={() => { setRoleFilterOpen(false); setStatusFilterOpen(false); }}
            >
                <ScrollView
                    horizontal
                    style={styles.horizontalScroll}
                    showsHorizontalScrollIndicator
                    onScrollBeginDrag={() => { setRoleFilterOpen(false); setStatusFilterOpen(false); }}
                >
                    <View style={styles.userListCard}>
                        <Text style={styles.userListTitle}>User List ({filteredUsers.length} users)</Text>
                        <View style={styles.userListHeader}>
                            <View style={styles.nameColHeader}>
                                <Text style={styles.userListHeaderText}>Name</Text>
                            </View>
                            <View style={{ flex: 2, alignItems: "flex-start", justifyContent: "center" }}>
                                <Text style={styles.userListHeaderText}>Contact</Text>
                            </View>
                            <View style={styles.roleColHeader}>
                                <Text style={[styles.userListHeaderText, { textAlign: "center" }]}>Role</Text>
                            </View>
                            <View style={styles.statusColHeader}>
                                <Text style={[styles.userListHeaderText, { textAlign: "center" }]}>Status</Text>
                            </View>
                            <View style={styles.createdColHeader}>
                                <Text style={[styles.userListHeaderText, { textAlign: "center" }]}>Created</Text>
                            </View>
                            <View style={styles.actionsColHeader}>
                                <Text style={[styles.userListHeaderText, { textAlign: "center" }]}>Actions</Text>
                            </View>
                        </View>
                        {filteredUsers.map((user) => (
                            <TouchableOpacity
                                key={user.id}
                                style={[
                                    styles.userRow,
                                    pressedRow === user.id && { backgroundColor: "#F4F4F4" },
                                ]}
                                activeOpacity={1}
                                onPressIn={() => setPressedRow(user.id)}
                                onPressOut={() => setPressedRow(null)}
                            >
                                {/* Name */}
                                <View style={styles.nameCol}>
                                    <Text style={styles.userName} numberOfLines={2}>
                                        {(() => {
                                            const fullName = `${user.firstName} ${user.lastName}`.trim().split(" ");
                                            if (fullName.length <= 2) {
                                                return fullName.join(" ");
                                            } else {
                                                return `${fullName.slice(0, 2).join(" ")}\n${fullName.slice(2).join(" ")}`;
                                            }
                                        })()}
                                    </Text>
                                </View>
                                {/* Contact */}
                                <View style={styles.contactCol}>
                                    <View style={styles.contactColumn}>
                                        <View style={styles.contactRow}>
                                            <MaterialCommunityIcons name="email-outline" size={16} color="#8A99A8" style={{ marginRight: 8 }} />
                                            <Text style={styles.userContact} numberOfLines={1}>{user.email}</Text>
                                        </View>
                                        <View style={styles.contactRow}>
                                            <MaterialCommunityIcons name="phone-outline" size={16} color="#8A99A8" style={{ marginRight: 8 }} />
                                            <Text style={styles.userContact} numberOfLines={1}>{user.phone}</Text>
                                        </View>
                                    </View>
                                </View>
                                {/* Role */}
                                <View style={styles.roleCol}>
                                    <View style={styles.roleCell}>
                                        <MaterialCommunityIcons
                                            name="shield-account-outline"
                                            size={15}
                                            color={roleTextColors[user.role]}
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text style={[styles.roleBadgeText, { color: roleTextColors[user.role] }]}>{user.role}</Text>
                                    </View>
                                </View>
                                {/* Status */}
                                <View style={styles.statusCol}>
                                    <View
                                        style={[
                                            styles.statusCell,
                                            user.status === "active"
                                                ? { backgroundColor: "#E6F6E6" }
                                                : { backgroundColor: "#FDECEC" },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.statusBadgeText,
                                                user.status === "active" ? { color: "#5CB85C" } : { color: "#D9534F" },
                                            ]}
                                        >
                                            {user.status}
                                        </Text>
                                    </View>
                                </View>
                                {/* Created */}
                                <View style={styles.createdCol}>
                                    <Text style={styles.createdDate}>{user.created}</Text>
                                </View>
                                {/* Actions */}
                                <View style={styles.actionsCol}>
                                    <TouchableOpacity onPress={() => handleEditUser(user)}>
                                        <MaterialCommunityIcons name="pencil-outline" size={20} color="#234187" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleForcePasswordChange(user)}>
                                        <MaterialCommunityIcons name="lock-outline" size={20} color="#234187" style={{ marginLeft: 12 }} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteUser(user)}>
                                        <MaterialCommunityIcons
                                            name="trash-can-outline"
                                            size={20}
                                            color="#D9534F"
                                            style={{ marginLeft: 12 }}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
                {/* Edit User Account Form */}
                <View style={styles.editUserWrapper}>
                    <Text style={styles.editUserTitle}>Edit User Account</Text>
                    <Text style={styles.editUserLabel}>Firstname</Text>
                    <TextInput
                        style={styles.editUserInput}
                        value={editUser.firstName}
                        onChangeText={text => setEditUser({ ...editUser, firstName: text })}
                        placeholder="Firstname"
                    />
                    <Text style={styles.editUserLabel}>Middlename</Text>
                    <TextInput
                        style={styles.editUserInput}
                        value={editUser.middleName}
                        onChangeText={text => setEditUser({ ...editUser, middleName: text })}
                        placeholder="Middlename"
                    />
                    <Text style={styles.editUserLabel}>Lastname</Text>
                    <TextInput
                        style={styles.editUserInput}
                        value={editUser.lastName}
                        onChangeText={text => setEditUser({ ...editUser, lastName: text })}
                        placeholder="Lastname"
                    />
                    <Text style={styles.editUserLabel}>Email</Text>
                    <TextInput
                        style={styles.editUserInput}
                        value={editUser.email}
                        onChangeText={text => setEditUser({ ...editUser, email: text })}
                        placeholder="Email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    <Text style={styles.editUserLabel}>Mobile Number</Text>
                    <TextInput
                        style={styles.editUserInput}
                        value={editUser.phone}
                        onChangeText={text => setEditUser({ ...editUser, phone: text })}
                        placeholder="Mobile Number"
                        keyboardType="phone-pad"
                    />
                    <Text style={styles.editUserLabel}>Role</Text>
                    <View style={styles.roleFieldContainer}>
                        <View style={styles.roleFieldWrapper}>
                            <TouchableOpacity
                                onPress={() => setRoleOpen(o => !o)}
                                style={styles.editUserPicker}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.roleValueText}>{editUser.role}</Text>
                                <MaterialCommunityIcons
                                    name={roleOpen ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color="#000"
                                />
                            </TouchableOpacity>

                            {roleOpen && (
                                <View style={styles.roleDropdown}>
                                    {roles.map(r => (
                                        <TouchableOpacity
                                            key={r}
                                            style={styles.roleOption}
                                            onPress={() => { setEditUser({ ...editUser, role: r }); setRoleOpen(false); }}
                                        >
                                            <Text style={styles.roleOptionText}>{r}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={styles.editUserButtonRow}>
                        {/* Save Changes */}
                        <TouchableOpacity
                            style={[
                                styles.editUserSaveBtn,
                                saveBtnPressed && styles.btnPressedBg,
                            ]}
                            activeOpacity={0.8}
                            onPressIn={() => setSaveBtnPressed(true)}
                            onPressOut={() => setSaveBtnPressed(false)}
                            onPress={() => {
                                setSavedVisible(true);
                                setTimeout(() => setSavedVisible(false), 1500);
                            }}
                        >
                            <MaterialCommunityIcons
                                name="check"
                                size={20}
                                color={saveBtnPressed ? "#fff" : "#000"}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.editUserSaveBtnText,
                                    saveBtnPressed && { color: "#fff" },
                                ]}
                            >
                                Save Changes
                            </Text>
                        </TouchableOpacity>

                        {/* Cancel */}
                        <TouchableOpacity
                            style={[
                                styles.editUserCancelBtn,
                                cancelBtnPressed && styles.btnPressedBg,
                            ]}
                            activeOpacity={0.8}
                            onPressIn={() => setCancelBtnPressed(true)}
                            onPressOut={() => setCancelBtnPressed(false)}
                            onPress={() => setRoleOpen(false)}
                        >
                            <MaterialCommunityIcons
                                name="close"
                                size={20}
                                color={cancelBtnPressed ? "#fff" : "#000"}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.editUserCancelBtnText,
                                    cancelBtnPressed && { color: "#fff" },
                                ]}
                            >
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Save success modal */}
            <Modal
                transparent
                visible={savedVisible}
                animationType="fade"
                onRequestClose={() => setSavedVisible(false)}
            >
                <View style={styles.overlay}>
                    <TouchableOpacity activeOpacity={1} onPress={() => setSavedVisible(false)}>
                        <View style={styles.savedCard}>
                            <View style={styles.iconOuter}>
                                <View style={styles.iconInner}>
                                    <MaterialCommunityIcons name="check" size={36} color="#22C55E" />
                                </View>
                            </View>
                            <Text style={styles.savedText}>Saved Successful!</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* Force Password Change Modal */}
            <Modal
                transparent
                visible={forcePasswordVisible}
                animationType="fade"
                onRequestClose={() => setForcePasswordVisible(false)}
            >
                <View style={styles.overlay}>
                    <View style={styles.passwordChangeModal}>
                        <Text style={styles.passwordChangeTitle}>Force Password Change</Text>
                        <Text style={styles.passwordChangeMessage}>
                            Are you sure you want to force {selectedUser?.firstName} {selectedUser?.lastName} to reset his password?{"\n"}
                            He will be notified and required to create a new password next login.
                        </Text>
                        
                        <TouchableOpacity
                            style={[
                                styles.confirmButton,
                                confirmBtnPressed && styles.confirmButtonPressed
                            ]}
                            activeOpacity={0.8}
                            onPressIn={() => setConfirmBtnPressed(true)}
                            onPressOut={() => setConfirmBtnPressed(false)}
                            onPress={handleConfirmPasswordChange}
                        >
                            <Text style={[
                                styles.confirmButtonText,
                                confirmBtnPressed && styles.confirmButtonTextPressed
                            ]}>
                                Confirm
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.cancelPasswordButton,
                                cancelPasswordBtnPressed && styles.cancelPasswordButtonPressed
                            ]}
                            activeOpacity={0.8}
                            onPressIn={() => setCancelPasswordBtnPressed(true)}
                            onPressOut={() => setCancelPasswordBtnPressed(false)}
                            onPress={() => {
                                setForcePasswordVisible(false);
                                setSelectedUser(null);
                            }}
                        >
                            <Text style={[
                                styles.cancelPasswordButtonText,
                                cancelPasswordBtnPressed && styles.cancelPasswordButtonTextPressed
                            ]}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Password Reset Success Modal */}
            <Modal
                transparent
                visible={passwordResetSuccessVisible}
                animationType="fade"
            >
                <View style={styles.overlay}>
                    <View style={styles.passwordResetSuccessModal}>
                        <View style={styles.successIconContainer}>
                            <MaterialCommunityIcons name="check" size={48} color="#4CAF50" />
                        </View>
                        <Text style={styles.passwordResetSuccessTitle}>Password reset initiated</Text>
                        <Text style={styles.passwordResetSuccessSubtitle}>User will be notified</Text>
                        <Text style={styles.passwordResetSuccessLoading}>Loading your dashboard...</Text>
                    </View>
                </View>
            </Modal>

            {/* Delete User Modal */}
            <Modal
                transparent
                visible={deleteUserVisible}
                animationType="fade"
                onRequestClose={() => setDeleteUserVisible(false)}
            >
                <View style={styles.overlay}>
                    <View style={styles.deleteUserModal}>
                        <Text style={styles.deleteUserTitle}>Remove User Access</Text>
                        <Text style={styles.deleteUserMessage}>
                            Are you sure you want to remove {selectedUser?.firstName} {selectedUser?.lastName}?{"\n"}
                            This will mark account as inactive and immediately disable all login access.
                        </Text>
                        
                        <TouchableOpacity
                            style={[
                                styles.deleteConfirmButton,
                                deleteConfirmBtnPressed && styles.deleteConfirmButtonPressed
                            ]}
                            activeOpacity={0.8}
                            onPressIn={() => setDeleteConfirmBtnPressed(true)}
                            onPressOut={() => setDeleteConfirmBtnPressed(false)}
                            onPress={handleConfirmDelete}
                        >
                            <Text style={[
                                styles.deleteConfirmButtonText,
                                deleteConfirmBtnPressed && styles.deleteConfirmButtonTextPressed
                            ]}>
                                Confirm
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.deleteCancelButton,
                                deleteCancelBtnPressed && styles.deleteCancelButtonPressed
                            ]}
                            activeOpacity={0.8}
                            onPressIn={() => setDeleteCancelBtnPressed(true)}
                            onPressOut={() => setDeleteCancelBtnPressed(false)}
                            onPress={() => {
                                setDeleteUserVisible(false);
                                setSelectedUser(null);
                            }}
                        >
                            <Text style={[
                                styles.deleteCancelButtonText,
                                deleteCancelBtnPressed && styles.deleteCancelButtonTextPressed
                            ]}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Delete Success Modal */}
            <Modal
                transparent
                visible={deleteSuccessVisible}
                animationType="fade"
            >
                <View style={styles.overlay}>
                    <View style={styles.deleteSuccessModal}>
                        <View style={styles.successIconContainer}>
                            <MaterialCommunityIcons name="check" size={48} color="#4CAF50" />
                        </View>
                        <Text style={styles.deleteSuccessTitle}>Account marked as inactive</Text>
                        <Text style={styles.deleteSuccessSubtitle}>Access disabled</Text>
                        <Text style={styles.deleteSuccessLoading}>Loading your dashboard...</Text>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const COLUMN_PADDING = 12;

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#fff",
    },
    topBarWrapper: {
        backgroundColor: "#fff",
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 0,
        zIndex: 10,
    },
    container: {
        flex: 1,
        backgroundColor: "#fff",
        paddingHorizontal: 18,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F7F9FB",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: "#E3E8EF",
        marginBottom: 10,
        width: "100%",
        zIndex: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: "#222",
    },
    filtersRow: {
        flexDirection: "row",
        justifyContent: "flex-start",
        gap: 12,
        marginBottom: 10,
        width: "100%",
        zIndex: 20,
    },
    filterButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#E3E8EF",
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 10,
    },
    filterText: {
        color: "#000",
        fontWeight: "500",
        fontSize: 15,
        marginRight: 2,
    },
    userListCard: {
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E3E8EF",
        marginBottom: 18,
        marginTop: 4,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        minWidth: 700,
        width: "auto",
        alignSelf: "flex-start",
    },
    userListTitle: {
        fontSize: 17,
        fontWeight: "bold",
        color: "#222",
        marginBottom: 12,
    },
    userListHeader: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#E3E8EF",
        paddingBottom: 10,
        marginBottom: 2,
    },
    userListHeaderText: {
        fontWeight: "700",
        color: "#222",
        fontSize: 15,
    },
    userRow: {
        flexDirection: "row",
        alignItems: "stretch",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F2F4F8",
        minHeight: 64,
    },
    nameColHeader: {
        flex: 2,
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
    },
    contactColHeader: {
        flex: 2,
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
    },
    roleColHeader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
    },
    statusColHeader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
    },
    createdColHeader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
    },
    actionsColHeader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
    },
    nameCol: {
        flex: 2,
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
    },
    contactCol: {
        flex: 2,
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
        alignSelf: "stretch",
    },
    roleCol: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
        alignSelf: "stretch",
    },
    statusCol: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
        alignSelf: "stretch",
    },
    createdCol: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
    },
    actionsCol: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: COLUMN_PADDING,
        paddingRight: COLUMN_PADDING,
    },
    userName: {
        fontWeight: "600",
        fontSize: 16,
        color: "#222",
        lineHeight: 24,
        paddingBottom: 2,
    },
    userContact: {
        fontSize: 14,
        color: "#444",
        lineHeight: 20,
        maxWidth: 200,
        minWidth: 120,
        textAlignVertical: "center",
    },
    roleCell: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 32,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: "#E3EAFD",
        borderRadius: 20,
        alignSelf: "center",
    },
    statusCell: {
        minHeight: 32,
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        alignSelf: "center",
    },
    roleBadgeText: {
        fontWeight: "600",
        fontSize: 13,
        textTransform: "capitalize",
    },
    statusBadgeText: {
        fontWeight: "600",
        fontSize: 13,
        textTransform: "capitalize",
    },
    createdDate: {
        fontSize: 13,
        color: "#444",
        textAlign: "center",
    },
    horizontalScroll: {
        marginBottom: 18,
    },
    contactColumn: {
        flex: 1,
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
    },
    contactRow: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 24,
        marginBottom: 0,
    },
    editUserWrapper: {
        backgroundColor: "#F4F7FB",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#D6E0EF",
        padding: 24,
        marginTop: 24,
        marginHorizontal: 0,
        width: "100%",
        alignSelf: "center",
        maxWidth: 480,
    },
    editUserTitle: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 18,
        color: "#222",
    },
    editUserLabel: {
        fontSize: 15,
        marginBottom: 6,
        color: "#222",
    },
    editUserInput: {
        borderWidth: 1,
        borderColor: "#C9D3E0",
        borderRadius: 8,
        padding: 10,
        marginBottom: 14,
        backgroundColor: "#fff",
        fontSize: 15,
    },
    roleFieldContainer: {
        width: 160,
        alignSelf: "flex-start",
    },
    roleFieldWrapper: {
        position: "relative",
        marginBottom: 18,
    },
    editUserPicker: {
        borderWidth: 1,
        borderColor: "rgba(13, 96, 156, 0.76)",
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: "#fff",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    roleValueText: {
        color: "#000",
        fontSize: 15,
        fontWeight: "600",
    },
    roleDropdown: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#C9D3E0",
        borderRadius: 10,
        marginTop: 6,
        overflow: "hidden",
        zIndex: 20,
    },
    roleOption: {
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    roleOptionText: {
        color: "#000",
        fontSize: 15,
        fontWeight: "500",
    },
    editUserButtonRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
    },
    editUserSaveBtn: {
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: "center",
        marginRight: 8,
        flexDirection: "row",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#C9D3E0",
    },
    editUserSaveBtnText: {
        color: "#000",
        fontWeight: "600",
        fontSize: 16,
    },
    editUserCancelBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#C9D3E0",
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: "center",
        marginLeft: 8,
        flexDirection: "row",
        justifyContent: "center",
        backgroundColor: "#fff",
    },
    editUserCancelBtnText: {
        color: "#000",
        fontWeight: "600",
        fontSize: 16,
    },
    btnPressedBg: {
        backgroundColor: "#133E87",
        borderColor: "#133E87",
    },
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
    },
    savedCard: {
        width: 300,
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: "center",
    },
    iconOuter: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: "#E8FBE8",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },
    iconInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#fff",
        borderWidth: 4,
        borderColor: "#22C55E",
        justifyContent: "center",
        alignItems: "center",
    },
    savedText: {
        fontSize: 20,
        fontWeight: "700",
        color: "#234187",
    },
    fullscreenDismiss: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
        backgroundColor: "transparent",
    },
    filterDropdownWrapper: {
        position: "relative",
        zIndex: 30,
    },
    filterDropdown: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        marginTop: 6,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#E3E8EF",
        borderRadius: 10,
        overflow: "hidden",
        zIndex: 40,
    },
    filterDropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    filterDropdownItemText: {
        fontSize: 15,
        color: "#000",
        fontWeight: "500",
    },
    // Force Password Change Modal Styles
    passwordChangeModal: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 32,
        width: "85%",
        maxWidth: 400,
        alignItems: "center",
    },
    passwordChangeTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: "#DC2626",
        marginBottom: 16,
        textAlign: "center",
    },
    passwordChangeMessage: {
        fontSize: 15,
        color: "#444",
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 22,
    },
    confirmButton: {
        width: "100%",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 12,
    },
    confirmButtonPressed: {
        backgroundColor: "#133E87",
        borderColor: "#133E87",
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
    },
    confirmButtonTextPressed: {
        color: "#fff",
    },
    cancelPasswordButton: {
        width: "100%",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
    },
    cancelPasswordButtonPressed: {
        backgroundColor: "#133E87",
        borderColor: "#133E87",
    },
    cancelPasswordButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
    },
    cancelPasswordButtonTextPressed: {
        color: "#fff",
    },
    // Password Reset Success Modal Styles
    passwordResetSuccessModal: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 40,
        width: "90%",
        maxWidth: 400,
        alignItems: "center",
    },
    successIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#E8F5E9",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    passwordResetSuccessTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#133E87",
        textAlign: "center",
        marginBottom: 8,
    },
    passwordResetSuccessSubtitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#133E87",
        textAlign: "center",
        marginBottom: 20,
    },
    passwordResetSuccessLoading: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
    },
    // Delete User Modal Styles
    deleteUserModal: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 32,
        width: "85%",
        maxWidth: 400,
        alignItems: "center",
    },
    deleteUserTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: "#DC2626",
        marginBottom: 16,
        textAlign: "center",
    },
    deleteUserMessage: {
        fontSize: 15,
        color: "#444",
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 22,
    },
    deleteConfirmButton: {
        width: "100%",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 12,
    },
    deleteConfirmButtonPressed: {
        backgroundColor: "#133E87",
        borderColor: "#133E87",
    },
    deleteConfirmButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
    },
    deleteConfirmButtonTextPressed: {
        color: "#fff",
    },
    deleteCancelButton: {
        width: "100%",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
    },
    deleteCancelButtonPressed: {
        backgroundColor: "#133E87",
        borderColor: "#133E87",
    },
    deleteCancelButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
    },
    deleteCancelButtonTextPressed: {
        color: "#fff",
    },
    // Delete Success Modal Styles
    deleteSuccessModal: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 40,
        width: "90%",
        maxWidth: 400,
        alignItems: "center",
    },
    deleteSuccessTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#133E87",
        textAlign: "center",
        marginBottom: 8,
    },
    deleteSuccessSubtitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#133E87",
        textAlign: "center",
        marginBottom: 20,
    },
    deleteSuccessLoading: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
    },
});