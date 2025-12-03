// Privacy Policy screen
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";

const PrivacyPolicy = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>1. Agreement to Terms</Text>
        <Text style={styles.paragraph}>By accessing or using our Service (the "Service"), you agree to be bound by these Terms and Conditions ("Terms"), and our Privacy Policy. If you disagree with any part of the terms, you may not access the Service.</Text>

        <Text style={styles.sectionTitle}>2. Definitions</Text>
        <Text style={styles.paragraph}>Service refers to the [Your Website Name] website and/or mobile application.

      Company (referred to as "we," "us," or "our") refers to [Your Company Name], located at [Your Company Address].

      You means the individual accessing or using the Service, or the company or other legal entity on behalf of which such individual is accessing or using the Service.</Text>

        <Text style={styles.sectionTitle}>3. User Accounts</Text>
        <Text style={styles.paragraph}>When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms.

      You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.

      You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.</Text>

        <Text style={styles.sectionTitle}>4. Intellectual Property</Text>
        <Text style={styles.paragraph}>The Service and its original content (excluding content provided by you or other users), features, and functionality are and will remain the exclusive property of [Your Company Name] and its licensors.

      Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of [Your Company Name].

      You grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, publish, and distribute any content you post on or through the Service.</Text>

        <Text style={styles.sectionTitle}>5. Links to Other Websites</Text>
        <Text style={styles.paragraph}>Our Service may contain links to third-party websites or services that are not owned or controlled by [Your Company Name].

      We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services.

      You acknowledge and agree that the Company shall not be responsible or liable, directly or indirectly, for any damage or loss caused by or in connection with the use of or reliance on any such content, goods, or services available on or through any such websites or services.</Text>

        <Text style={styles.sectionTitle}>6. Termination</Text>
        <Text style={styles.paragraph}>We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.

      Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service.</Text>

        <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
        <Text style={styles.paragraph}>In no event shall [Your Company Name], nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use, or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage.</Text>

        <Text style={styles.sectionTitle}>8. "AS IS" and "AS AVAILABLE" Disclaimer</Text>
        <Text style={styles.paragraph}>The Service is provided to you "AS IS" and "AS AVAILABLE" and with all faults and defects without warranty of any kind.

      The Company makes no warranty or representation that the Service will meet your requirements, achieve any intended results, be compatible or work with any other software, applications, systems, or services, operate without interruption, meet any performance or reliability standards, or be error-free.</Text>

        <Text style={styles.sectionTitle}>9. Governing Law</Text>
        <Text style={styles.paragraph}>The laws of the Country, excluding its conflicts of law rules, shall govern these Terms and your use of the Service. Your use of the Application may also be subject to other local, state, national, or international laws.</Text>

        <Text style={styles.sectionTitle}>10. Changes to These Terms and Conditions</Text>
        <Text style={styles.paragraph}>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will try to provide at least [Number] days' notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</Text>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

export default PrivacyPolicy;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  bottomNavContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  topBar: {
    height: 64,
    paddingTop: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    position: "absolute",
    top: 18,
    left: 12,
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000000ff",
  },
  content: {
    paddingHorizontal: 26,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    color: "#000",
  },
  paragraph: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
 
});
