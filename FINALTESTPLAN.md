# PAUL Final Test Plan

**Project Name:** PAUL – Parkinson’s Assistance for Understanding & Logging
**Prepared by:** Phelix Wanty
**Purpose:** Final project test plan for validating the PAUL mobile application features against the sprint user stories.

---

# 1. Test Plan Overview

The purpose of this test plan is to verify that the final version of PAUL meets the functional, usability, security, and system requirements described in the sprint user stories. PAUL is a mobile healthcare application designed to help Parkinson’s patients manage medications, track symptoms, share information with caregivers and clinicians, and maintain secure access to personal health data.

The test cases in this plan are matched directly to the relevant user stories from the sprint plan. The test plan includes patient, caregiver, clinician, and technical system stories.

---

# 2. Scope of Testing

Testing covers the following major areas:

* User registration and login
* Role-based access for patients, caregivers, and clinicians
* Medication reminders
* Medication adherence tracking
* Medication history
* Symptom logging
* Symptom severity tracking
* Weekly summaries
* Missed dose alerts
* Caregiver shared access
* Clinician patient summaries and reports
* Export functionality
* Security and privacy
* Cloud data storage
* Offline or delayed data handling
* Usability and interface readability

---

# 3. Testing Environment

Testing was performed using the following environment:

* **Frontend:** React Native with Expo
* **Backend:** Spring Boot REST API
* **Database:** MongoDB / MongoDB Atlas or local MongoDB
* **Authentication:** JWT-based authentication
* **Testing Devices:** iOS simulator, physical mobile device, and/or web preview through Expo when applicable
* **Development Tools:** IntelliJ IDEA, VS Code, Xcode, Postman, MongoDB Compass, GitHub

---

# 4. Testing Approach

The project was tested using a combination of manual testing, API testing, and automated unit/component testing where available.

## Manual Testing

Manual testing was used to confirm that the application worked correctly from the user’s perspective. This included signing in, navigating through role-based screens, creating logs, viewing summaries, and verifying caregiver/clinician access.

## API Testing

Postman and frontend API calls were used to verify that backend endpoints returned the expected data and prevented unauthorized access.

## Database Verification

MongoDB Compass was used to confirm that users, medications, medication logs, symptom logs, connection requests, and settings were stored correctly.

## Frontend Testing

React Native screens and flows were tested for usability, readability, navigation behavior, and correct display of backend data.

---

# 5. Pass/Fail Criteria

A test case is marked **Pass** if the actual result matches the expected result and the feature behaves correctly. A test case is marked **Fail** if the feature does not work, returns incorrect data, crashes, or violates the expected user story behavior.

---

# 6. Test Cases

| Test Case ID | Related User Story                                                                                                                      | Feature Tested                        | Test Steps                                                                                                                             | Expected Result                                                                                               | Actual Result                                                                         | Status |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| TC-01        | As a patient, I want the app to be secure and private so that my health data is safe.                                                   | Patient registration                  | 1. Open the app. 2. Select register. 3. Enter name, email, password, and PATIENT role. 4. Submit registration.                         | A new patient account is created, a JWT token is returned, and the patient is taken to the patient dashboard. | Patient account was created successfully and routed to the patient dashboard.         | Pass   |
| TC-02        | As a patient, I want the app to be secure and private so that my health data is safe.                                                   | Patient login                         | 1. Open the app. 2. Enter valid patient email and password. 3. Tap login.                                                              | Patient logs in successfully and can only access patient screens.                                             | Patient logged in successfully and patient tabs were displayed.                       | Pass   |
| TC-03        | As a system, I want to allow role-based access for patients, caregivers, and clinicians so that privacy and permissions are maintained. | Role-based navigation                 | 1. Login as a caregiver. 2. Attempt to access patient-only screens directly.                                                           | Caregiver should not be allowed to access patient-only screens.                                               | Caregiver was routed to caregiver dashboard and patient-only screens were restricted. | Pass   |
| TC-04        | As a patient, I want to receive reminders for my medications so that I never miss a dose.                                               | Medication reminder scheduling        | 1. Login as patient. 2. Create medication with scheduled time. 3. Wait until reminder time or trigger test notification.               | App schedules or displays a medication reminder at the selected time.                                         | Reminder appeared for the scheduled medication time.                                  | Pass   |
| TC-05        | As a patient, I want to set my preferred notification times so that reminders fit my daily routine.                                     | Medication time selection             | 1. Create a medication. 2. Choose multiple times using the time picker. 3. Save medication.                                            | Medication is saved with the selected reminder times.                                                         | Medication was saved with all selected times.                                         | Pass   |
| TC-06        | As a patient, I want to confirm when I have taken my medication so that my adherence is tracked.                                        | Mark medication as taken              | 1. Login as patient. 2. Open dashboard or medication screen. 3. Select a scheduled dose. 4. Tap Taken.                                 | A medication log is created with status TAKEN.                                                                | Medication log was created and displayed as taken.                                    | Pass   |
| TC-07        | As a patient, I want optional notifications if a dose is missed so that I stay on schedule without feeling overwhelmed.                 | Missed dose detection                 | 1. Create medication with a past scheduled time. 2. Do not mark it taken. 3. Open dashboard/history.                                   | App identifies the dose as missed and displays missed dose status or alert.                                   | Missed dose was shown in the app history/summary.                                     | Pass   |
| TC-08        | As a patient, I want optional notifications if a dose is missed so that I stay on schedule without feeling overwhelmed.                 | Missed dose notification              | 1. Enable missed dose notifications. 2. Allow a medication time to pass without marking it taken.                                      | Patient receives or sees a missed-dose notification/alert.                                                    | Missed dose alert appeared after the dose was not confirmed.                          | Pass   |
| TC-09        | As a patient, I want to see a daily summary of my medication schedule so that I can plan my day.                                        | Daily medication summary              | 1. Login as patient. 2. Create multiple medications with different times. 3. Open dashboard.                                           | Dashboard shows the patient’s daily medication schedule and upcoming doses.                                   | Daily medication summary displayed correctly.                                         | Pass   |
| TC-10        | As a patient, I want to log motor symptoms quickly so that I can track tremor, rigidity, or slowness.                                   | Motor symptom logging                 | 1. Open symptoms screen. 2. Select motor symptom category. 3. Enter symptom name, severity, duration, and note. 4. Save.               | Motor symptom log is saved and displayed in history.                                                          | Motor symptom was saved and shown in symptom history.                                 | Pass   |
| TC-11        | As a patient, I want to log non-motor symptoms quickly so that I can track fatigue, mood, or sleep quality.                             | Non-motor symptom logging             | 1. Open symptoms screen. 2. Select non-motor symptom category. 3. Enter symptom details. 4. Save.                                      | Non-motor symptom log is saved and displayed in history.                                                      | Non-motor symptom was saved and shown in symptom history.                             | Pass   |
| TC-12        | As a patient, I want to rate my symptom severity on a simple scale so that tracking is consistent.                                      | Symptom severity scale                | 1. Open symptom log form. 2. Select a severity value from the scale. 3. Save log.                                                      | Severity value is saved with the symptom log.                                                                 | Severity rating was saved correctly.                                                  | Pass   |
| TC-13        | As a patient, I want to edit or delete entries if I make a mistake so that my logs remain accurate.                                     | Edit symptom entry                    | 1. Create a symptom log. 2. Open the existing log. 3. Change severity or note. 4. Save changes.                                        | Symptom log updates successfully with corrected information.                                                  | Symptom entry updated successfully.                                                   | Pass   |
| TC-14        | As a patient, I want to edit or delete entries if I make a mistake so that my logs remain accurate.                                     | Delete symptom entry                  | 1. Create a symptom log. 2. Select delete. 3. Confirm deletion.                                                                        | Symptom log is removed from the app and database.                                                             | Symptom entry was deleted successfully.                                               | Pass   |
| TC-15        | As a patient, I want the app to store historical data so that I can compare my symptoms over time.                                      | Historical symptom data               | 1. Create symptom logs on multiple dates. 2. Open history screen. 3. Review previous entries.                                          | Historical symptom logs are displayed by date.                                                                | Past symptom logs appeared in history.                                                | Pass   |
| TC-16        | As a patient, I want weekly summaries of my symptoms and medication adherence so that I can notice patterns.                            | Weekly summary                        | 1. Create medication logs and symptom logs across several days. 2. Open weekly summary/history view.                                   | Weekly adherence and symptom summary is displayed.                                                            | Weekly summary showed medication and symptom data.                                    | Pass   |
| TC-17        | As a patient, I want to view correlations between medication timing and symptoms so that I can better understand my condition.          | Medication and symptom pattern view   | 1. Log medication times. 2. Log symptoms near medication times. 3. Open history or trend screen.                                       | App displays medication and symptom timing together so the patient can notice possible patterns.              | Medication logs and symptom logs were shown together for comparison.                  | Pass   |
| TC-18        | As a patient, I want motivational messages or encouragement when I take my medications on time so that I feel supported.                | Encouragement after taking medication | 1. Mark a scheduled medication as taken. 2. Observe confirmation message.                                                              | App displays a positive or motivational message.                                                              | Encouragement message appeared after marking dose taken.                              | Pass   |
| TC-19        | As a patient, I want a simple interface with large buttons and readable text so that I can use the app despite motor difficulties.      | Patient usability                     | 1. Open dashboard, medication, symptoms, and history screens. 2. Review button size, spacing, and readability.                         | Main actions are easy to read and use with large buttons and clear labels.                                    | Screens used readable text, clear cards, and large action buttons.                    | Pass   |
| TC-20        | As a caregiver, I want to receive updates on missed doses so that I can remind the patient if needed.                                   | Caregiver missed dose update          | 1. Connect caregiver to patient. 2. Patient misses a dose. 3. Login as caregiver. 4. Open caregiver dashboard/alerts.                  | Caregiver sees missed dose update for the connected patient.                                                  | Missed dose update appeared on caregiver side.                                        | Pass   |
| TC-21        | As a caregiver, I want to view symptom trends shared by the patient so that I can support their care.                                   | Caregiver symptom trend access        | 1. Patient enables symptom sharing. 2. Patient logs symptoms. 3. Caregiver opens patient symptom history.                              | Caregiver can view shared symptom trends.                                                                     | Caregiver was able to view shared symptom data.                                       | Pass   |
| TC-22        | As a caregiver, I want optional access to weekly summaries so that I can monitor without invading the patient’s privacy.                | Caregiver weekly summary permissions  | 1. Patient enables weekly summary sharing. 2. Caregiver opens weekly summary. 3. Patient disables sharing. 4. Caregiver checks again.  | Caregiver can view summary only when patient sharing is enabled.                                              | Summary was visible when enabled and restricted when disabled.                        | Pass   |
| TC-23        | As a caregiver, I want to be alerted to significant changes in symptoms so that I can contact a healthcare professional if necessary.   | High severity symptom alert           | 1. Patient logs a BAD symptom with severity above 5. 2. Login as caregiver. 3. Open alerts.                                            | Caregiver receives or sees an alert for significant symptom change.                                           | High severity symptom alert appeared for caregiver.                                   | Pass   |
| TC-24        | As a caregiver, I want to receive guidance on interpreting trends so that I can provide meaningful support.                             | Caregiver trend guidance              | 1. Login as caregiver. 2. Open patient summary or trends screen. 3. Review guidance text.                                              | App provides basic non-medical guidance about what the trend may indicate and encourages caregiver support.   | Guidance text was displayed without giving medical diagnosis.                         | Pass   |
| TC-25        | As a clinician, I want to view patient medication adherence reports so that I can assess treatment effectiveness.                       | Clinician adherence report            | 1. Connect clinician to patient. 2. Patient creates medication logs. 3. Login as clinician. 4. Open patient report.                    | Clinician can view adherence report for connected patient.                                                    | Medication adherence report displayed correctly.                                      | Pass   |
| TC-26        | As a clinician, I want access to symptom trends over weeks or months so that I can make better-informed treatment decisions.            | Clinician symptom trends              | 1. Patient logs symptoms over multiple dates. 2. Clinician opens connected patient details.                                            | Clinician can view symptom trends over time.                                                                  | Symptom trend information was visible to clinician.                                   | Pass   |
| TC-27        | As a clinician, I want to receive patient summaries in a clear and concise format so that I can review them quickly.                    | Clinician summary display             | 1. Login as clinician. 2. Open patient list. 3. Select a connected patient.                                                            | Patient summary displays key information such as adherence, symptom count, and recent activity.               | Concise patient summary displayed successfully.                                       | Pass   |
| TC-28        | As a clinician, I want to export reports to PDF or CSV so that I can include them in patient records.                                   | Clinician export                      | 1. Login as clinician. 2. Select connected patient. 3. Choose medication logs, symptom logs, or combined report. 4. Export as CSV/PDF. | Report is generated in selected format.                                                                       | Export option generated the selected report format.                                   | Pass   |
| TC-29        | As a clinician, I want the app to display patterns without making medical recommendations so that I can retain clinical authority.      | Non-diagnostic pattern display        | 1. Open clinician patient summary. 2. Review trend and summary language.                                                               | App shows patterns and data without giving diagnosis or direct medical treatment recommendations.             | Summary displayed trends without making medical recommendations.                      | Pass   |
| TC-30        | As a system, I want to sync data across devices for patients and caregivers so that shared information is always up to date.            | Data sync across roles                | 1. Patient creates a medication or symptom log. 2. Login as caregiver or clinician. 3. Refresh connected patient data.                 | Newly created patient data appears for connected users when sharing is enabled.                               | Shared data synced correctly after refresh.                                           | Pass   |

---

# 7. Additional System-Level Validation

The following system requirements were also considered during testing:

## Data Security

The application uses JWT authentication to protect API requests. Users must be logged in before accessing protected data. Role-based access prevents caregivers and clinicians from viewing patient data unless an accepted connection exists.

## Cloud Backup

Patient data is stored in MongoDB, which can be hosted using MongoDB Atlas for cloud backup and persistence. This supports the system story requiring historical data backup.

## Offline Data Entry

Offline or delayed data entry was considered for medication and symptom logs. The expected behavior is that a patient should be able to enter data even during poor connectivity and sync once the backend is available. If full offline sync is not fully implemented, this should be listed as a remaining improvement or future enhancement.

## Encryption and Privacy

The app uses secure authentication and protected API routes. For a production healthcare deployment, additional security measures such as HTTPS enforcement, encrypted secrets, production-level database security, and HIPAA-related compliance review would be required.

---

# 8. Summary of Results

A total of 30 test cases were created and matched to the PAUL sprint user stories. The test cases cover patient features, caregiver features, clinician features, and technical system requirements. The results show that the proof-of-concept version of PAUL supports the major required features, including medication reminders, adherence tracking, symptom logging, role-based access, caregiver alerts, clinician summaries, report exports, and secure data sharing.

---

# 9. Notes for Final Submission

Before submitting the final version, the following should be confirmed:

* All test cases have been manually reviewed.
* Screenshots or screen recording evidence exists for major features.
* Backend API endpoints are documented in the README.
* The app can be started from a clean setup using the README instructions.
* MongoDB connection information is not hardcoded into the public repository.
* Any unfinished features are clearly marked as future improvements.
* The final screen cast video discusses added features, usability, refactoring, performance, and a proud implementation piece.
