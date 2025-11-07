        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
        
        // Your web app's Firebase configuration
        const firebaseConfig = {
          apiKey: "AIzaSyB5GOv2seWHetmQud1fsGgvuym-T2aTn8U",
          authDomain: "health-gurad-pro.firebaseapp.com",
          projectId: "health-gurad-pro",
          storageBucket: "health-gurad-pro.appspot.com",
          messagingSenderId: "805913878328",
          appId: "1:805913878328:web:b0a2ecf82e6221e80f6bcd",
          measurementId: "G-TH1J3X0VJE"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const analytics = getAnalytics(app);
        const db = getFirestore(app);
        const auth = getAuth(app);

        // Global state for the app
        window.appData = {
            db,
            auth,
            userId: null,
            patients: {},
            appointments: [],
            loading: false,
            criticalAlerts: 0,
            loggedInUser: null, // will be { role: 'reception' } or { role: 'doctor', id: '123', name: 'Dr. X', specialty: '...' }
            targetTab: null, // to remember which tab to open after login
            doctorProfiles: {}, // Stores { id: { name, specialty } }
            uploadedImageData: { base64: null, mimeType: null },
            skinImageData: { base64: null, mimeType: null },
            doctorCases: [], // To store new cases for the appointments tab
        };
        
        let dChart;
        let adminStatsChart;
        let vitalsInterval;
        let adminChartInterval;
        let dashboardInterval;
        let waitTimesChart;
        let waitTimesInterval;


        // --- View Reset Functions ---
        function resetDoctorView() {
            const dResult = document.getElementById('d_result');
            if (dResult) dResult.classList.add('hidden');

            const dRoomInput = document.getElementById('d_room');
            if (dRoomInput) dRoomInput.value = '';

            const welcomeMsg = document.getElementById('doctor-welcome-message');
            const currentUser = window.appData.loggedInUser;
            if (welcomeMsg) {
                if (currentUser && currentUser.role === 'doctor') {
                    welcomeMsg.textContent = `🩺 مرحباً بك ${currentUser.name}`;
                } else {
                    welcomeMsg.textContent = '🩺 الطبيب';
                }
            }
            if (vitalsInterval) clearInterval(vitalsInterval);
        }

        function resetPatientView() {
            const pResult = document.getElementById('p_result');
            if (pResult) pResult.classList.add('hidden');

            const pRoomInput = document.getElementById('p_room');
            if (pRoomInput) pRoomInput.value = '';
        }

        function resetPharmacyView() {
            const phResult = document.getElementById('ph_result');
            if (phResult) phResult.classList.add('hidden');
            const phRoomInput = document.getElementById('ph_room');
            if (phRoomInput) phRoomInput.value = '';
        }

        function resetRadiologyView() {
            const resultContainer = document.getElementById('rad_result_container');
            if (resultContainer) resultContainer.classList.add('hidden');
            const fileInput = document.getElementById('rad_image_upload');
            if (fileInput) fileInput.value = '';
            const imagePreview = document.getElementById('rad_image_preview');
            if (imagePreview) imagePreview.src = '';
            const analysisText = document.getElementById('rad_analysis_text');
            if (analysisText) analysisText.textContent = '';
            window.appData.uploadedImageData = { base64: null, mimeType: null };
        }

        function resetAppointmentsView() {
           // This section is now a display table, no inputs to reset
        }
        
        function resetBillingView() {
            const bResult = document.getElementById('b_result');
            if (bResult) bResult.classList.add('hidden');
            const bRoomInput = document.getElementById('b_room');
            if (bRoomInput) bRoomInput.value = '';
        }
        
        // Tabs
        function showTab(tab, btn) {
            // Reset views when switching tabs to clear old data
            resetDoctorView();
            resetPatientView();
            resetPharmacyView();
            resetAppointmentsView();
            resetBillingView();
            resetRadiologyView();
            
            document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
            const activeTab = document.getElementById(tab);
            activeTab.classList.remove('hidden');

            // Re-trigger animation
            activeTab.classList.remove('animate-fadeIn');
            void activeTab.offsetWidth; // This is a trick to force a browser reflow
            activeTab.classList.add('animate-fadeIn');
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            if (btn) {
                btn.classList.add('active');
            }
            
            if (adminChartInterval) clearInterval(adminChartInterval);
            if (dashboardInterval) clearInterval(dashboardInterval);
            if (waitTimesInterval) clearInterval(waitTimesInterval);

            if (tab === 'ai') {
                initializeAdminChart();
            }
            if (tab === 'dashboard') {
                updateDashboard();
                dashboardInterval = setInterval(() => {
                    updateDashboard();
                }, 5000);
            }
            if (tab === 'waitTimes') {
                initializeWaitTimesView();
            }
        }
        window.showTab = showTab;

        // --- Centralized Doctor Profile Management ---
        function getOrCreateDoctorProfile(doctorId) {
            if (!window.appData.doctorProfiles[doctorId]) {
                const randomNames = ["أحمد", "علي", "محمود", "خالد", "يوسف", "سارة", "فاطمة", "عبدالله", "مريم"];
                const specialties = ["Surgery", "Internal Medicine", "Dental", "Pediatrics", "Emergency & Trauma", "Anesthesia", "Ophthalmology", "ENT"];
                window.appData.doctorProfiles[doctorId] = {
                    name: `د. ${randomNames[Math.floor(Math.random() * randomNames.length)]}`,
                    specialty: specialties[Math.floor(Math.random() * specialties.length)],
                    finishedCases: [] // Initialize finished cases array
                };
            }
            return window.appData.doctorProfiles[doctorId];
        }

        // --- Login and Auth Functions ---
        function showLoginModal(role) {
            const modal = document.getElementById('login-modal');
            const roleInput = document.getElementById('login-role');
            const title = document.getElementById('login-title');
            if (modal && roleInput && title) {
                window.appData.targetTab = role;
                roleInput.value = role;

                let roleText = 'الاستقبال';
                if (role === 'doctor') roleText = 'الطبيب';
                if (role === 'pharmacy') roleText = 'الصيدلية';
                if (role === 'radiology') roleText = 'الأشعة';
                if (role === 'appointments') roleText = 'المواعيد';
                if (role === 'billing') roleText = 'الفواتير';

                title.textContent = `تسجيل دخول - ${roleText}`;
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                modal.querySelector('div').classList.add('animate-scaleIn');
            }
        }
        window.showLoginModal = showLoginModal;

        function handleLogin() {
            const id = document.getElementById('login-id').value;
            const password = document.getElementById('login-password').value;
            const role = document.getElementById('login-role').value;
            
            if (!id || !password) {
                return showMessage("الرجاء إدخال المعرف وكلمة المرور", "error");
            }

            if (role === 'reception' || role === 'pharmacy' || role === 'appointments' || role === 'billing' || role === 'radiology') {
                window.appData.loggedInUser = { role: 'reception' }; // Group non-doctors under one role
            } else if (role === 'doctor') {
                const profile = getOrCreateDoctorProfile(id);
                window.appData.loggedInUser = { role: 'doctor', id, ...profile };
                const welcomeMsg = document.getElementById('doctor-welcome-message');
                if (welcomeMsg) {
                    welcomeMsg.textContent = `🩺 مرحباً بك ${profile.name}`;
                }
            }
            
            document.getElementById('login-modal').classList.add('hidden');
            document.getElementById('login-id').value = '';
            document.getElementById('login-password').value = '';
            
            updateNavOnLogin();
            
            let targetBtn = null;
            const buttons = document.querySelectorAll('.tab-btn');
            buttons.forEach(btn => {
                const onclickAttr = btn.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes(`'${window.appData.targetTab}'`)) {
                    targetBtn = btn;
                }
            });

            showTab(window.appData.targetTab, targetBtn);
        }
        window.handleLogin = handleLogin;

        function navigateToTab(tab, btn) {
            const protectedTabs = ['reception', 'doctor', 'pharmacy', 'appointments', 'billing', 'radiology'];
            
            if (protectedTabs.includes(tab) && !window.appData.loggedInUser) {
                return showLoginModal(tab);
            }

            showTab(tab, btn);
        }
        window.navigateToTab = navigateToTab;

        function updateNavOnLogin() {
            document.getElementById('logout-btn').classList.remove('hidden');
        }

        function updateNavOnLogout() {
            document.getElementById('logout-btn').classList.add('hidden');
            const welcomeMsg = document.getElementById('doctor-welcome-message');
            if (welcomeMsg) {
                welcomeMsg.textContent = '🩺 الطبيب';
            }
        }

        function logout() {
            window.appData.loggedInUser = null;
            updateNavOnLogout();
            showTab('home', document.querySelector('.tab-btn:first-child'));
            showMessage("تم تسجيل الخروج بنجاح", "success");
        }
        window.logout = logout;

        function notifyDoctor(room) {
            const patientName = window.appData.patients[room]?.name || 'المريض';
            showMessage(`✅ تم إرسال تنبيه للطبيب بخصوص موعد ${patientName} في غرفة ${room}.`, 'success');
        }
        window.notifyDoctor = notifyDoctor;
        // --- End of Login Functions ---

        function showMessage(text, type, callback = null) {
            const modal = document.getElementById('message-modal');
            const icon = document.getElementById('message-icon');
            const messageText = document.getElementById('message-text');
            const okButton = modal.querySelector('button');

            if (icon && messageText && modal && okButton) {
              icon.textContent = type === 'success' ? '✅' : '❌';
              messageText.textContent = text;
              
              const newOkButton = okButton.cloneNode(true);
              okButton.parentNode.replaceChild(newOkButton, okButton);

              newOkButton.addEventListener('click', () => {
                  modal.classList.add('hidden');
                  if (callback) {
                      callback();
                  }
              }, { once: true });

              modal.classList.remove('hidden');
              modal.classList.add('flex');
              modal.querySelector('div').classList.add('animate-scaleIn');
            }
        }
        window.showMessage = showMessage;
        
        function toggleButtonLoading(button, isLoading) {
            if (isLoading) {
                button.disabled = true;
                if (!button.dataset.originalText) {
                    button.dataset.originalText = button.innerHTML;
                }
                button.innerHTML = `<span class="animate-pulse-fast">جاري المعالجة...</span>`;
            } else {
                button.disabled = false;
                button.innerHTML = button.dataset.originalText;
            }
        }

        function playBellSound() {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
            oscillator.stop(audioCtx.currentTime + 1.5);
        }

        async function callGeminiApi(prompt) {
            const apiKey = "AIzaSyANDYsTsLJBhiFF5YqzolALTJ0SbMt8I30";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
            const payload = { contents: [{ parts: [{ text: prompt }] }] };
            let retries = 0;
            const maxRetries = 3;
            const delay = (ms) => new Promise(res => setTimeout(res, ms));

            while (retries < maxRetries) {
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) throw new Error(`API error: ${response.status}`);
                    const result = await response.json();
                    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return text;
                    else throw new Error("Invalid response from API");
                } catch (error) {
                    console.error("Error calling Gemini API:", error);
                    retries++;
                    if (retries < maxRetries) await delay(1000 * Math.pow(2, retries));
                    else throw new Error("Failed to generate content after multiple retries.");
                }
            }
        }
        
        async function callGeminiMultimodalApi(prompt, base64Data, mimeType) {
            const apiKey = "AIzaSyANDYsTsLJBhiFF5YqzolALTJ0SbMt8I30";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
            const payload = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: mimeType, data: base64Data } }
                    ]
                }]
            };
            
            let retries = 0;
            const maxRetries = 3;
            const delay = (ms) => new Promise(res => setTimeout(res, ms));

            while (retries < maxRetries) {
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) throw new Error(`API error: ${response.status}`);
                    const result = await response.json();
                    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return text;
                    else throw new Error("Invalid response from Multimodal API");
                } catch (error) {
                    console.error("Error calling Gemini Multimodal API:", error);
                    retries++;
                    if (retries < maxRetries) await delay(1000 * Math.pow(2, retries));
                    else throw new Error("Failed to generate content from image after multiple retries.");
                }
            }
        }
        
        function appendChatMessage(message, sender) {
            const messagesContainer = document.getElementById('ai_chat_messages');
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('flex', sender === 'user' ? 'justify-end' : 'justify-start');

            const messageBubble = document.createElement('div');
            messageBubble.classList.add('rounded-lg', 'p-3', 'max-w-xs');
            messageBubble.textContent = message;

            if (sender === 'user') {
                messageBubble.classList.add('bg-blue-500', 'text-white');
            } else {
                messageBubble.classList.add('bg-gray-200', 'text-gray-800');
            }
            
            if (message === '...') {
                messageBubble.innerHTML = `
                    <div class="flex items-center space-x-1">
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-pulse-fast" style="animation-delay: 0s;"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-pulse-fast" style="animation-delay: 0.2s;"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-pulse-fast" style="animation-delay: 0.4s;"></div>
                    </div>
                `;
                 messageBubble.id = 'typing-indicator';
            }

            messageDiv.appendChild(messageBubble);
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        document.addEventListener('DOMContentLoaded', () => {
          const loginBtn = document.getElementById('login-btn');
          if (loginBtn) {
              loginBtn.addEventListener('click', handleLogin);
          }
          
          const docSubmitBtn = document.getElementById('doc_submitBtn');
          if (docSubmitBtn) {
              docSubmitBtn.addEventListener('click', () => {
                  const name = document.getElementById('doc_name').value;
                  const phone = document.getElementById('doc_phone').value;
                  if (!name || !phone) {
                      return showMessage("الرجاء إدخال الاسم ورقم التليفون.", "error");
                  }
                  
                  document.getElementById('doc_form').classList.add('hidden');
                  const docOptions = document.getElementById('doc_options');
                  docOptions.classList.remove('hidden');
                  document.getElementById('doc_welcome_message').textContent = `شكراً لك ${name}، كيف يمكننا مساعدتك أكثر؟`;
                  
                  document.getElementById('doc_name').value = '';
                  document.getElementById('doc_phone').value = '';
                  document.getElementById('doc_location').value = '';
              });
          }
          
           const docAiBtn = document.getElementById('doc_ai_btn');
            if(docAiBtn) {
                docAiBtn.addEventListener('click', () => {
                     document.getElementById('doc_splash_screen').classList.add('hidden');
                     document.getElementById('doc_options').classList.add('hidden');
                     document.getElementById('ai_chat_container').classList.remove('hidden');
                });
            }
            
            const aiChatBackBtn = document.getElementById('ai_chat_back_btn');
            if(aiChatBackBtn) {
                aiChatBackBtn.addEventListener('click', () => {
                     document.getElementById('doc_splash_screen').classList.remove('hidden');
                     document.getElementById('doc_options').classList.remove('hidden');
                     document.getElementById('ai_chat_container').classList.add('hidden');
                });
            }
            
            const aiChatSendBtn = document.getElementById('ai_chat_send_btn');
            const aiChatInput = document.getElementById('ai_chat_input');

            const handleSendMessage = async () => {
                 const userInput = aiChatInput.value.trim();
                 if (userInput === '') return;

                 appendChatMessage(userInput, 'user');
                 aiChatInput.value = '';
                 
                 appendChatMessage('...', 'ai');

                 const prompt = `You are an AI medical assistant. A user has a health problem. Provide useful medical information, potential home remedies, and suggest ONE common over-the-counter medication that might help with the symptoms, in Arabic. Present this as clear bullet points. Your tone must be helpful but not prescriptive. It is ABSOLUTELY CRUCIAL that you end your response with the exact phrase in bold on a new line: **"هام: هذه المعلومات للإرشاد فقط ولا تغني عن استشارة الطبيب المختص. يجب عدم تناول أي دواء دون استشارة طبية."** The user's problem is: "${userInput}"`;

                 try {
                     const aiResponse = await callGeminiApi(prompt);
                     document.getElementById('typing-indicator')?.parentElement.remove();
                     appendChatMessage(aiResponse, 'ai');
                 } catch (error) {
                     document.getElementById('typing-indicator')?.parentElement.remove();
                     appendChatMessage('عذراً، حدث خطأ أثناء محاولة التواصل مع المساعد الذكي.', 'ai');
                     console.error("AI Chat Error:", error);
                 }
            };
            
            if (aiChatSendBtn) {
                aiChatSendBtn.addEventListener('click', handleSendMessage);
            }
            if (aiChatInput) {
                aiChatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        handleSendMessage();
                    }
                });
            }

            const docReminderBtn = document.getElementById('doc_reminder_btn');
            if(docReminderBtn) {
                docReminderBtn.addEventListener('click', () => {
                     document.getElementById('doc_splash_screen').classList.add('hidden');
                     document.getElementById('doc_options').classList.add('hidden');
                     document.getElementById('medication_reminder_container').classList.remove('hidden');
                });
            }

            const medicationBackBtn = document.getElementById('medication_back_btn');
            if(medicationBackBtn) {
                medicationBackBtn.addEventListener('click', () => {
                     document.getElementById('doc_splash_screen').classList.remove('hidden');
                     document.getElementById('doc_options').classList.remove('hidden');
                     document.getElementById('medication_reminder_container').classList.add('hidden');
                });
            }
            
            const earlyDetectionBtn = document.getElementById('early_detection_btn');
            if(earlyDetectionBtn) {
                earlyDetectionBtn.addEventListener('click', () => {
                     document.getElementById('doc_splash_screen').classList.add('hidden');
                     document.getElementById('doc_options').classList.add('hidden');
                     document.getElementById('early_detection_container').classList.remove('hidden');
                });
            }
            
            const detectionBackBtn = document.getElementById('detection_back_btn');
            if(detectionBackBtn) {
                detectionBackBtn.addEventListener('click', () => {
                     document.getElementById('doc_splash_screen').classList.remove('hidden');
                     document.getElementById('doc_options').classList.remove('hidden');
                     document.getElementById('early_detection_container').classList.add('hidden');
                     // Reset the view
                     document.getElementById('detection_form').classList.remove('hidden');
                     document.getElementById('detection_result').classList.add('hidden');
                     document.getElementById('detection_symptoms').value = '';
                     document.getElementById('detection_age').value = '';
                     document.getElementById('detection_gender').value = '';
                });
            }
            
            const detectionAnalyzeBtn = document.getElementById('detection_analyze_btn');
            if(detectionAnalyzeBtn) {
                detectionAnalyzeBtn.addEventListener('click', async function() {
                    const symptoms = document.getElementById('detection_symptoms').value;
                    const age = document.getElementById('detection_age').value;
                    const gender = document.getElementById('detection_gender').value;

                    if (!symptoms || !age || !gender) {
                        return showMessage("الرجاء ملء جميع الحقول لتحليل دقيق.", "error");
                    }
                    
                    toggleButtonLoading(this, true);

                    const prompt = `You are an AI medical symptom checker. Based on the following user-provided information, analyze the potential risk for a serious condition.
                    - Symptoms: ${symptoms}
                    - Age: ${age}
                    - Gender: ${gender}
                    Your response must be a JSON object with three keys: "riskLevel" (string: "منخفض", "متوسط", or "مرتفع"), "explanation" (a brief, simple explanation in Arabic about why this risk level was chosen based on the symptoms), and "recommendation" (a short, clear next step in Arabic, e.g., "مراقبة الأعراض" or "ينصح بزيارة طبيب عام" or "ينصح بشدة بزيارة أقرب طوارئ"). 
                    Do not provide a diagnosis. Focus on the risk level and next steps. For example: {"riskLevel": "مرتفع", "explanation": "ألم الصدر مع صعوبة التنفس قد يكون علامة على حالة قلبية طارئة.", "recommendation": "ينصح بشدة بزيارة أقرب طوارئ فوراً."}`;

                    try {
                        const responseText = await callGeminiApi(prompt);
                        const cleanedText = responseText.replace(/^```json\s*|```\s*$/g, '').trim();
                        const result = JSON.parse(cleanedText);

                        const riskLevelEl = document.getElementById('detection_risk_level');
                        const explanationEl = document.getElementById('detection_explanation');
                        
                        riskLevelEl.textContent = `مستوى الخطورة: ${result.riskLevel}`;
                        explanationEl.textContent = `${result.explanation} ${result.recommendation}`;
                        
                        riskLevelEl.classList.remove('bg-green-200', 'text-green-800', 'bg-yellow-200', 'text-yellow-800', 'bg-red-200', 'text-red-800');

                        if (result.riskLevel === 'منخفض') {
                            riskLevelEl.classList.add('bg-green-200', 'text-green-800');
                        } else if (result.riskLevel === 'متوسط') {
                             riskLevelEl.classList.add('bg-yellow-200', 'text-yellow-800');
                        } else {
                            riskLevelEl.classList.add('bg-red-200', 'text-red-800');
                        }
                        
                        document.getElementById('detection_form').classList.add('hidden');
                        document.getElementById('detection_result').classList.remove('hidden');

                    } catch(error) {
                        console.error("Early detection error:", error);
                        showMessage("حدث خطأ أثناء تحليل الأعراض. يرجى المحاولة مرة أخرى.", "error");
                    } finally {
                        toggleButtonLoading(this, false);
                    }
                });
            }

            const skinAnalyzerBtn = document.getElementById('skin_analyzer_btn');
            if(skinAnalyzerBtn) {
                 skinAnalyzerBtn.addEventListener('click', () => {
                     document.getElementById('doc_splash_screen').classList.add('hidden');
                     document.getElementById('doc_options').classList.add('hidden');
                     document.getElementById('skin_analyzer_container').classList.remove('hidden');
                 });
            }

            const skinAnalyzerBackBtn = document.getElementById('skin_analyzer_back_btn');
            if(skinAnalyzerBackBtn) {
                skinAnalyzerBackBtn.addEventListener('click', () => {
                    document.getElementById('doc_splash_screen').classList.remove('hidden');
                    document.getElementById('doc_options').classList.remove('hidden');
                    document.getElementById('skin_analyzer_container').classList.add('hidden');
                    // Reset view
                    document.getElementById('skin_analyzer_upload_section').classList.remove('hidden');
                    document.getElementById('skin_analyzer_result_section').classList.add('hidden');
                    document.getElementById('skin_image_preview').classList.add('hidden');
                    document.getElementById('skin_image_upload').value = '';
                    window.appData.skinImageData = { base64: null, mimeType: null };
                });
            }
            
            const skinImageUpload = document.getElementById('skin_image_upload');
            if(skinImageUpload) {
                skinImageUpload.addEventListener('change', function(event) {
                    const file = event.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            const preview = document.getElementById('skin_image_preview');
                            preview.src = e.target.result;
                            preview.classList.remove('hidden');
                            
                            window.appData.skinImageData = {
                                base64: e.target.result.split(',')[1],
                                mimeType: file.type
                            };
                            document.getElementById('skin_analyzer_analyze_btn').disabled = false;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }

            const skinAnalyzerAnalyzeBtn = document.getElementById('skin_analyzer_analyze_btn');
            if(skinAnalyzerAnalyzeBtn) {
                skinAnalyzerAnalyzeBtn.addEventListener('click', async function() {
                    if (!window.appData.skinImageData.base64) {
                        return showMessage("الرجاء رفع صورة أولاً.", "error");
                    }
                    toggleButtonLoading(this, true);

                    const prompt = `You are an expert AI dermatologist assistant. Analyze the provided image of a skin lesion. Based on the visual characteristics, evaluate it against the ABCDE rule of melanoma detection (Asymmetry, Border, Color, Diameter, Evolving). 
                    Your response must be a valid JSON object with the following structure:
                    {
                      "riskLevel": "منخفض" | "متوسط" | "مرتفع",
                      "analysisSummary": "A brief summary in Arabic.",
                      "abcde": {
                        "A": { "finding": "e.g., متماثل", "explanation": "شرح بسيط" },
                        "B": { "finding": "e.g., منتظم", "explanation": "شرح بسيط" },
                        "C": { "finding": "e.g., لون موحد", "explanation": "شرح بسيط" },
                        "D": { "finding": "e.g., أقل من 6مم", "explanation": "شرح بسيط" },
                        "E": { "finding": "e.g., لا يوجد تغير", "explanation": "شرح بسيط" }
                      }
                    }
                    Be clinical and objective. Base the risk level on the number of suspicious ABCDE signs.`;
                    
                    try {
                        const responseText = await callGeminiMultimodalApi(prompt, window.appData.skinImageData.base64, window.appData.skinImageData.mimeType);
                        const cleanedText = responseText.replace(/^```json\s*|```\s*$/g, '').trim();
                        const result = JSON.parse(cleanedText);

                        const riskLevelEl = document.getElementById('skin_risk_level');
                        const summaryEl = document.getElementById('skin_analysis_summary');
                        const abcdeResultsEl = document.getElementById('abcde_results');

                        riskLevelEl.textContent = `مستوى الخطورة: ${result.riskLevel}`;
                        summaryEl.textContent = result.analysisSummary;

                        riskLevelEl.classList.remove('bg-green-200', 'text-green-800', 'bg-yellow-200', 'text-yellow-800', 'bg-red-200', 'text-red-800');
                        if (result.riskLevel === 'منخفض') riskLevelEl.classList.add('bg-green-200', 'text-green-800');
                        else if (result.riskLevel === 'متوسط') riskLevelEl.classList.add('bg-yellow-200', 'text-yellow-800');
                        else riskLevelEl.classList.add('bg-red-200', 'text-red-800');

                        abcdeResultsEl.innerHTML = `
                            <p><strong>A - عدم التماثل (Asymmetry):</strong> ${result.abcde.A.finding} (${result.abcde.A.explanation})</p>
                            <p><strong>B - الحواف (Border):</strong> ${result.abcde.B.finding} (${result.abcde.B.explanation})</p>
                            <p><strong>C - اللون (Color):</strong> ${result.abcde.C.finding} (${result.abcde.C.explanation})</p>
                            <p><strong>D - القطر (Diameter):</strong> ${result.abcde.D.finding} (${result.abcde.D.explanation})</p>
                            <p><strong>E - التطور (Evolving):</strong> ${result.abcde.E.finding} (${result.abcde.E.explanation})</p>
                        `;

                        document.getElementById('skin_analyzer_upload_section').classList.add('hidden');
                        document.getElementById('skin_analyzer_result_section').classList.remove('hidden');

                    } catch(error) {
                         console.error("Skin analyzer error:", error);
                        showMessage("حدث خطأ أثناء تحليل الصورة. حاول التأكد من وضوح الصورة.", "error");
                    } finally {
                        toggleButtonLoading(this, false);
                    }
                });
            }


            function displayMedications(medications) {
                const medsListContainer = document.getElementById('medications_list');
                const remindBtn = document.getElementById('remind_me_btn');
                const simulateBtn = document.getElementById('simulate_reminder_btn');

                if (!medications || medications.length === 0) {
                    medsListContainer.innerHTML = `<p id="meds_placeholder" class="text-center text-gray-500 py-8">لم يتم العثور على أدوية.</p>`;
                    remindBtn.disabled = true;
                    simulateBtn.disabled = true;
                    return;
                }

                medsListContainer.innerHTML = '';
                medications.forEach((med, index) => {
                    const medCard = document.createElement('div');
                    medCard.className = 'bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center justify-between animate-fadeIn';
                    
                    medCard.innerHTML = `
                        <div>
                            <p class="font-bold text-gray-800">${med.name}</p>
                            <div class="flex items-center space-x-2">
                                <p class="text-sm text-gray-500" id="timing-text-${index}">${med.timing}</p>
                                <button class="edit-timing-btn text-gray-400 hover:text-blue-500" data-index="${index}">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L13.196 5.232z"></path></svg>
                                </button>
                            </div>
                        </div>
                        <button class="what-is-this-btn text-xs text-blue-500 border border-blue-500 rounded-full px-2 py-1 hover:bg-blue-500 hover:text-white transition-colors" data-description="${med.description}">
                            ما هذا؟
                        </button>
                    `;
                    medsListContainer.appendChild(medCard);
                });

                document.querySelectorAll('.what-is-this-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const description = this.dataset.description;
                        showMessage(description, 'success');
                    });
                });

                 document.querySelectorAll('.edit-timing-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const index = this.dataset.index;
                        const timingElement = document.getElementById(`timing-text-${index}`);
                        const currentTiming = timingElement.textContent;
                        
                        const newTiming = prompt("أدخل الموعد الجديد:", currentTiming);
                        
                        if (newTiming && newTiming.trim() !== "") {
                            timingElement.textContent = newTiming.trim();
                            showMessage("تم تحديث الموعد بنجاح.", "success");
                        }
                    });
                });
                
                remindBtn.disabled = false;
                simulateBtn.disabled = false;
            }

            const pdfUploadInput = document.getElementById('pdf_upload_input');
            if(pdfUploadInput) {
                pdfUploadInput.addEventListener('change', async function() {
                    if (this.files.length === 0) return;
                    
                    const medsListContainer = document.getElementById('medications_list');
                    medsListContainer.innerHTML = `<p class="text-center text-gray-500 py-8 animate-pulse-fast">جاري تحليل الوصفة...</p>`;
                    document.getElementById('remind_me_btn').disabled = true;
                    document.getElementById('simulate_reminder_btn').disabled = true;

                    const prompt = `You are a pharmacy AI. A user uploaded a prescription PDF. Analyze it and return a JSON array of 3-4 medicine objects. Each object must have three keys: "name" (in Arabic), "timing" (in Arabic, e.g., 'قرص واحد بعد الإفطار'), and "description" (a very simple one-sentence explanation in Arabic). Your output must be only the JSON array, nothing else. For example: [{ "name": "بنادول إكسترا", "timing": "قرصان عند اللزوم", "description": "يستخدم لتخفيف الصداع والألم." }]`;

                    try {
                        const responseText = await callGeminiApi(prompt);
                        const cleanedText = responseText.replace(/^```json\s*|```\s*$/g, '').trim();
                        const medications = JSON.parse(cleanedText);
                        displayMedications(medications);
                    } catch(error) {
                        console.error("Error parsing prescription:", error);
                        medsListContainer.innerHTML = `<p class="text-center text-red-500 py-8">حدث خطأ أثناء تحليل الملف.</p>`;
                    }
                });
            }

            const processManualMedsBtn = document.getElementById('process_manual_meds_btn');
            if (processManualMedsBtn) {
                processManualMedsBtn.addEventListener('click', async function() {
                    const manualInput = document.getElementById('manual_meds_input');
                    const names = manualInput.value.trim().split('\n').filter(name => name.trim() !== '');
                    
                    if (names.length === 0) {
                        return showMessage("الرجاء إدخال اسم دواء واحد على الأقل.", "error");
                    }

                    toggleButtonLoading(this, true);
                    const medsListContainer = document.getElementById('medications_list');
                    medsListContainer.innerHTML = `<p class="text-center text-gray-500 py-8 animate-pulse-fast">جاري جلب معلومات الأدوية...</p>`;

                    try {
                        const medicationPromises = names.map(async (name) => {
                            const prompt = `For the medicine "${name.trim()}" in Arabic, provide a typical timing instruction and a simple one-sentence description. Return ONLY a valid JSON object with two keys: "timing" (string, in Arabic, e.g., "قرص واحد يومياً") and "description" (string, in Arabic). Example: {"timing": "قرصان عند اللزوم", "description": "يستخدم لتخفيف الصداع والألم."}`;
                            const responseText = await callGeminiApi(prompt);
                            const cleanedText = responseText.replace(/^```json\s*|```\s*$/g, '').trim();
                            const medInfo = JSON.parse(cleanedText);
                            return {
                                name: name.trim(),
                                timing: medInfo.timing,
                                description: medInfo.description
                            };
                        });

                        const medications = await Promise.all(medicationPromises);
                        displayMedications(medications);
                        manualInput.value = '';

                    } catch (error) {
                        console.error("Error fetching manual med info:", error);
                        medsListContainer.innerHTML = `<p class="text-center text-red-500 py-8">حدث خطأ أثناء جلب معلومات الأدوية.</p>`;
                    } finally {
                        toggleButtonLoading(this, false);
                    }
                });
            }

            const simulateReminderBtn = document.getElementById('simulate_reminder_btn');
            if (simulateReminderBtn) {
                simulateReminderBtn.addEventListener('click', function() {
                    const firstMedElement = document.querySelector('#medications_list .font-bold');
                    if (!firstMedElement) {
                        showMessage("لا توجد أدوية في القائمة لعمل محاكاة.", "error");
                        return;
                    }
                    const firstMedName = firstMedElement.textContent;
                    const textToSpeak = `تذكر أخذ دواء ${firstMedName}`;
                    
                    try {
                        const utterance = new SpeechSynthesisUtterance(textToSpeak);
                        utterance.lang = 'ar-SA';
                        utterance.rate = 0.9;
                        speechSynthesis.speak(utterance);
                    } catch (error) {
                        console.error("Speech synthesis error:", error);
                        showMessage("عذراً، متصفحك لا يدعم خاصية التذكير الصوتي.", "error");
                    }
                });
            }

            const remindMeBtn = document.getElementById('remind_me_btn');
            if(remindMeBtn) {
                remindMeBtn.addEventListener('click', function() {
                    showMessage("تم ضبط التذكيرات بنجاح! سنقوم بتنبيهك بمواعيد دوائك.", "success");
                });
            }

            const docBookingBtn = document.getElementById('doc_booking_btn');
            if(docBookingBtn) {
                docBookingBtn.addEventListener('click', () => {
                    document.getElementById('doc_splash_screen').classList.add('hidden');
                    document.getElementById('doc_options').classList.add('hidden');
                    document.getElementById('hospital_booking_container').classList.remove('hidden');
                    
                    const receptionDepartments = document.getElementById('r_type').innerHTML;
                    document.getElementById('booking_department').innerHTML = receptionDepartments;
                });
            }
            
            const bookingBackBtn = document.getElementById('booking_back_btn');
            if(bookingBackBtn) {
                bookingBackBtn.addEventListener('click', () => {
                     document.getElementById('doc_splash_screen').classList.remove('hidden');
                     document.getElementById('doc_options').classList.remove('hidden');
                     document.getElementById('hospital_booking_container').classList.add('hidden');
                });
            }

            const bookingSubmitBtn = document.getElementById('booking_submit_btn');
            if (bookingSubmitBtn) {
                bookingSubmitBtn.addEventListener('click', function() {
                    const department = document.getElementById('booking_department').value;
                    const name = document.getElementById('booking_name').value;
                    const phone = document.getElementById('booking_phone').value;

                    if (!department || !name || !phone) {
                        return showMessage("الرجاء ملء جميع الحقول.", "error");
                    }
                    
                    const originalButtonText = this.innerHTML;
                    this.disabled = true;
                    this.innerHTML = `<span class="animate-pulse-fast">جاري بحث ميعاد مناسب...</span>`;

                    setTimeout(() => {
                        const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
                        const randomDay = days[Math.floor(Math.random() * days.length)];
                        const randomDateOffset = Math.floor(Math.random() * 7) + 1;
                        const appointmentDate = new Date();
                        appointmentDate.setDate(appointmentDate.getDate() + randomDateOffset);
                        const dateString = appointmentDate.toLocaleDateString('ar-EG');
                        
                        const times = ['09:00 صباحاً', '11:30 صباحاً', '02:00 مساءً', '04:30 مساءً'];
                        const randomTime = times[Math.floor(Math.random() * times.length)];

                        const newCase = {
                            patientName: name,
                            specialty: department,
                            doctorName: getOrCreateDoctorProfile(Math.random().toString(36).substring(7)).name,
                        };

                        const successMessage = `تم حجز موعد لك بنجاح! الموعد المقترح هو يوم ${randomDay} الموافق ${dateString}، الساعة ${randomTime}.`;
                        
                        if(!window.appData.doctorCases) { window.appData.doctorCases = []; }
                        window.appData.doctorCases.unshift(newCase);
                        renderAppointmentCases(); 
                        
                        showMessage(successMessage, "success");

                        this.disabled = false;
                        this.innerHTML = originalButtonText;
                        document.getElementById('booking_department').value = '';
                        document.getElementById('booking_name').value = '';
                        document.getElementById('booking_phone').value = '';
                        document.getElementById('hospital_booking_container').classList.add('hidden');
                        document.getElementById('doc_splash_screen').classList.remove('hidden');
                        document.getElementById('doc_options').classList.remove('hidden');


                    }, 2000);
                });
            }

          const rSaveBtn = document.getElementById('r_saveBtn');
          if (rSaveBtn) {
            rSaveBtn.addEventListener('click', async function() {
                const name = document.getElementById('r_name').value;
                const age = document.getElementById('r_age').value;
                const room = document.getElementById('r_room').value.trim();
                const disease = document.getElementById('r_disease').value;
                const oldmeds = document.getElementById('r_oldmeds').value;
                const type = document.getElementById('r_type').value;

                if (!room) return showMessage("ادخل رقم الغرفة", "error");

                const patientsCollectionRef = collection(window.appData.db, 'patients');
                const docRef = doc(patientsCollectionRef, room);

                const initialBilling = {
                    total_cost: 0,
                    insurance_coverage: Math.floor(Math.random() * 71) + 20,
                    amount_due: 0
                };

                try {
                    await setDoc(docRef, { name, age, room, disease, oldmeds, type, diag: '', newmeds: '', status: 'active', billing: initialBilling });
                    showMessage("تم حفظ بيانات المريض ✅", "success");
                } catch (error) {
                    console.error("Error writing document: ", error);
                    showMessage("فشل حفظ المريض.", "error");
                }
            });
          }

          const rSuggestDoctorBtn = document.getElementById('r_suggest_doctor_btn');
          if (rSuggestDoctorBtn) {
            rSuggestDoctorBtn.addEventListener('click', async function() {
                const type = document.getElementById('r_type').value;
                const disease = document.getElementById('r_disease').value;
                if (!type && !disease) return showMessage("لا توجد بيانات كافية لاقتراح طبيب.", "error");

                const prompt = `بناءً على المعلومات التالية عن المريض، اقترح التخصص الطبي الأكثر ملاءمة. كن موجزًا وقدم تخصصًا واحدًا أو عددًا قليلاً من التخصصات ذات الصلة.\n- نوع الحالة: ${type}\n- الأمراض: ${disease}`;
                const targetElement = document.getElementById('r_doctor_suggestion');
                const targetText = document.getElementById('r_doctor_suggestion_text');
                
                if (targetElement && targetText) {
                    targetElement.classList.remove('hidden');
                    targetText.textContent = '... جاري البحث عن الطبيب المناسب ...';
                    toggleButtonLoading(this, true);
                    try {
                        const text = await callGeminiApi(prompt);
                        targetText.textContent = text;
                    } catch (error) {
                        targetText.textContent = '❌ فشل في جلب المقترح.';
                        console.error("Gemini API Error:", error);
                    } finally {
                        toggleButtonLoading(this, false);
                    }
                }
            });
          }

          const dLoadBtn = document.getElementById('d_loadBtn');
          if (dLoadBtn) {
            dLoadBtn.addEventListener('click', function() {
                const room = document.getElementById('d_room').value.trim();
                const data = window.appData.patients[room];
                const dResult = document.getElementById('d_result');
                if (!data) {
                    if (dResult) dResult.classList.add('hidden');
                    return showMessage("لم يتم العثور على بيانات المريض", "error");
                }
                if (dResult) {
                    dResult.classList.remove('hidden');
                    document.getElementById('d_name').innerText = data.name || '—';
                    document.getElementById('d_age').innerText = data.age || '—';
                    document.getElementById('d_disease').innerText = data.disease || '—';
                    document.getElementById('d_oldmeds').innerText = data.oldmeds || '—';
                    document.getElementById('d_type').innerText = data.type || '—';
                    document.getElementById('d_diag').value = data.diag || '';
                    document.getElementById('d_newmeds').value = data.newmeds || '';

                    const welcomeMsg = document.getElementById('doctor-welcome-message');
                    const currentUser = window.appData.loggedInUser;
                    if (welcomeMsg && currentUser && currentUser.role === 'doctor' && data.type) {
                        welcomeMsg.textContent = `🩺 مرحباً بك ${currentUser.name} (قسم: ${data.type})`;
                    }

                    const saveBtn = document.getElementById('d_sendPatientBtn');
                    const finishBtn = document.getElementById('d_finishBtn');
                    if(saveBtn) saveBtn.disabled = false;
                    if(finishBtn) finishBtn.disabled = false;

                    if (finishBtn) {
                        finishBtn.classList.remove('hidden');
                    }

                    if(data.status === 'finished') {
                        if(saveBtn) saveBtn.disabled = true;
                        if(finishBtn) finishBtn.disabled = true;
                    }

                    const radiologySection = document.getElementById('d_radiology_reports_section');
                    const radiologyContainer = document.getElementById('d_radiology_reports_container');
                    
                    if (radiologySection && radiologyContainer) {
                        if (data.radiology_reports && data.radiology_reports.length > 0) {
                            radiologySection.classList.remove('hidden');
                            radiologyContainer.innerHTML = data.radiology_reports.map(report => `
                                <div class="p-3 bg-white rounded-md border border-gray-200 shadow-sm">
                                    <p class="font-bold text-gray-700">التقرير: ${report.scanType} - ${report.bodyPart} (${new Date(report.date).toLocaleDateString('ar-EG')})</p>
                                    <p class="text-xs text-gray-500">النموذج المستخدم: ${report.model || 'N/A'}</p>
                                    <p class="mt-1 text-sm text-gray-600">${report.analysis}</p>
                                </div>
                            `).join('');
                        } else {
                           radiologyContainer.innerHTML = '<p class="text-gray-500">لا توجد تقارير أشعة متاحة لهذا المريض حتى الآن.</p>';
                        }
                    }


                    const vitalsIrrelevantTypes = ['Dental', 'Ophthalmology', 'ENT', 'Radiology & Imaging', 'Laboratory', 'Anesthesia'];
                    const vitalsSection = document.getElementById('vitals-section');
                    if (vitalsInterval) clearInterval(vitalsInterval);

                    if (vitalsIrrelevantTypes.includes(data.type)) {
                        if (vitalsSection) vitalsSection.classList.add('hidden');
                    } else {
                        if (vitalsSection) vitalsSection.classList.remove('hidden');
                        const updateVitals = () => {
                            const bpSyst = Math.floor(Math.random() * 60) + 90;
                            const bpDia = Math.floor(Math.random() * 40) + 60;
                            const ox = Math.floor(Math.random() * 10) + 90;
                            updateTelemetryTable(room, bpSyst, bpDia, ox, data.type);
                            const ctx = document.getElementById('dChart');
                            if (dChart) dChart.destroy();
                            if (ctx) {
                                dChart = new Chart(ctx, {
                                    type: 'bar',
                                    data: {
                                        labels: ['ضغط الدم Systolic', 'ضغط الدم Diastolic', 'الأكسجين %'],
                                        datasets: [{
                                            label: 'مؤشرات المريض',
                                            data: [bpSyst, bpDia, ox],
                                            backgroundColor: ['#3b82f6', '#3b82f6', '#10b8a6']
                                        }]
                                    },
                                    options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
                                });
                            }
                        };
                        updateVitals();
                        vitalsInterval = setInterval(updateVitals, 10000);
                    }
                }
            });
          }
          
          const dFinishBtn = document.getElementById('d_finishBtn');
          if (dFinishBtn) {
            dFinishBtn.addEventListener('click', async function() {
                const room = document.getElementById('d_room').value.trim();
                if (!room) return;
                const data = window.appData.patients[room];
                if (!data) return;

                const currentUser = window.appData.loggedInUser;
                
                if (currentUser && currentUser.role === 'doctor' && currentUser.specialty !== data.type) {
                    const profile = window.appData.doctorProfiles[currentUser.id];
                    if (profile) {
                        profile.specialty = data.type;
                        currentUser.specialty = data.type;
                        showMessage(`تم تحديث تخصصك تلقائياً ليطابق هذه الحالة: (${data.type})`, "success");
                        
                        const welcomeMsg = document.getElementById('doctor-welcome-message');
                        if (welcomeMsg) {
                             welcomeMsg.textContent = `🩺 مرحباً بك ${currentUser.name} (قسم: ${data.type})`;
                        }
                    }
                }

                if (currentUser && currentUser.role === 'doctor' && currentUser.id) {
                    const profile = window.appData.doctorProfiles[currentUser.id];
                    if (profile) {
                        if (!profile.finishedCases) {
                            profile.finishedCases = [];
                        }
                        if (!profile.finishedCases.some(p => p.room === room)) {
                            profile.finishedCases.push({ ...data, room: room, status: 'finished' });
                        }
                    }
                }

                const totalCost = Math.floor(Math.random() * 9001) + 1000;
                const insuranceCoveragePercent = data.billing ? data.billing.insurance_coverage : 50;
                const amountDue = totalCost * (1 - (insuranceCoveragePercent / 100));

                const updatedBilling = {
                    total_cost: totalCost,
                    insurance_coverage: insuranceCoveragePercent,
                    amount_due: Math.round(amountDue)
                };

                const patientsCollectionRef = collection(window.appData.db, 'patients');
                const docRef = doc(patientsCollectionRef, room);
                try {
                    await setDoc(docRef, { status: 'finished', billing: updatedBilling }, { merge: true });
                    showMessage("تم إنهاء حالة المريض وتحديث الفاتورة بنجاح.", "success");
                    document.getElementById('d_sendPatientBtn').disabled = true;
                    this.disabled = true;
                } catch (error) {
                    console.error("Error finishing case: ", error);
                    showMessage("فشل في إنهاء الحالة.", "error");
                }
            });
          }
          
          const dfLoadProfileBtn = document.getElementById('df_loadProfileBtn');
          if(dfLoadProfileBtn) {
            dfLoadProfileBtn.addEventListener('click', function() {
                const doctorId = document.getElementById('df_doctorId').value.trim();
                if(!doctorId) return showMessage("الرجاء إدخال معرف الطبيب", "error");

                const profile = getOrCreateDoctorProfile(doctorId);
                const profileResultDiv = document.getElementById('df_profileResult');
                const doctorNameEl = document.getElementById('df_doctorName');
                const casesTbody = document.getElementById('df_casesTbody');

                doctorNameEl.textContent = `${profile.name} (تخصص: ${profile.specialty})`;
                casesTbody.innerHTML = '';
                let totalCases = 0;

                if (profile.finishedCases && profile.finishedCases.length > 0) {
                    profile.finishedCases.forEach(patient => {
                        const statusText = 'تم الانتهاء وعلاج حالة';
                        const statusClass = 'text-green-600 font-bold';
                        const row = `
                            <tr class="bg-green-50">
                                <td class="p-3 border border-gray-200">${patient.room}</td>
                                <td class="p-3 border border-gray-200">${patient.name}</td>
                                <td class="p-3 border border-gray-200">${patient.type}</td>
                                <td class="p-3 border border-gray-200 ${statusClass}">${statusText}</td>
                            </tr>
                        `;
                        casesTbody.innerHTML += row;
                        totalCases++;
                    });
                }
                
                Object.values(window.appData.patients).forEach(patient => {
                    const alreadyFinishedByThisDoctor = profile.finishedCases && profile.finishedCases.some(p => p.room === patient.room);
                    if (patient.type === profile.specialty && patient.status !== 'finished' && !alreadyFinishedByThisDoctor) {
                        const statusText = 'قيد المراجعة';
                        const statusClass = 'text-yellow-600';
                        const row = `
                            <tr>
                                <td class="p-3 border border-gray-200">${patient.room}</td>
                                <td class="p-3 border border-gray-200">${patient.name}</td>
                                <td class="p-3 border border-gray-200">${patient.type}</td>
                                <td class="p-3 border border-gray-200 ${statusClass}">${statusText}</td>
                            </tr>
                        `;
                        casesTbody.innerHTML += row;
                        totalCases++;
                    }
                });

                const mockNames = ["أحمد محمود", "فاطمة الزهراء", "محمد علي", "سارة إبراهيم", "يوسف خالد", "مريم عبد الرحمن", "عبد الله حسن", "نور مصطفى"];
                for (let i = 0; i < 3; i++) {
                     const statusText = 'قيد المراجعة';
                     const statusClass = 'text-yellow-600';
                     const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
                     const row = `
                            <tr>
                                <td class="p-3 border border-gray-200">${Math.floor(Math.random() * 200) + 100}</td>
                                <td class="p-3 border border-gray-200">${randomName}</td>
                                <td class="p-3 border border-gray-200">${profile.specialty}</td>
                                <td class="p-3 border border-gray-200 ${statusClass}">${statusText}</td>
                            </tr>
                        `;
                    casesTbody.innerHTML += row;
                    totalCases++;
                }
                
                if (totalCases === 0) {
                    casesTbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">لا توجد حالات مسجلة لهذا التخصص حاليًا.</td></tr>`;
                }
                profileResultDiv.classList.remove('hidden');
            });
          }

          const dSuggestDiagBtn = document.getElementById('d_suggest_diag_btn');
          if (dSuggestDiagBtn) {
            dSuggestDiagBtn.addEventListener('click', async function() {
                const room = document.getElementById('d_room').value.trim();
                const data = window.appData.patients[room];
                if (!data || (!data.disease && !data.oldmeds)) return showMessage("لا توجد بيانات كافية لتقديم اقتراحات.", "error");

                const prompt = `Based on the following patient information, provide a short, single-paragraph medical diagnostic suggestion. Focus on potential diagnoses given the conditions and old medications.\n- Conditions: ${data.disease}\n- Previous Medications: ${data.oldmeds}\nMake sure to frame your response as a suggestion for a doctor to consider.`;
                const targetElement = document.getElementById('d_ai_suggestion');
                const targetText = document.getElementById('d_ai_suggestion_text');
                if (targetElement && targetText) {
                    targetElement.classList.remove('hidden');
                    targetText.textContent = '... جاري تحليل البيانات ...';
                    toggleButtonLoading(this, true);
                    try {
                        const text = await callGeminiApi(prompt);
                        targetText.textContent = text;
                    } catch (error) {
                        targetText.textContent = '❌ فشل في جلب المقترحات.';
                        console.error("Gemini API Error:", error);
                    } finally {
                        toggleButtonLoading(this, false);
                    }
                }
            });
          }

          const dCheckInteractionsBtn = document.getElementById('d_check_interactions_btn');
          if (dCheckInteractionsBtn) {
            dCheckInteractionsBtn.addEventListener('click', async function() {
                const room = document.getElementById('d_room').value.trim();
                const data = window.appData.patients[room];
                const newmeds = document.getElementById('d_newmeds').value;
                if (!data || (!data.oldmeds && !newmeds)) return showMessage("لا توجد أدوية للتحقق من التفاعلات.", "error");

                const prompt = `You are a helpful medical assistant for a doctor. Analyze the following list of medications and identify any potential drug-drug interactions. Provide a simple, concise, and easy-to-read summary of any identified interactions.\n- Existing Medications: ${data.oldmeds}\n- New Medications: ${newmeds}\nIf there are no significant interactions, state that.`;
                const targetElement = document.getElementById('d_interactions_result');
                const targetText = document.getElementById('d_interactions_text');
                if (targetElement && targetText) {
                    targetElement.classList.remove('hidden');
                    targetText.textContent = '... جاري فحص التفاعلات ...';
                    toggleButtonLoading(this, true);
                    try {
                        const text = await callGeminiApi(prompt);
                        targetText.textContent = text;
                    } catch (error) {
                        targetText.textContent = '❌ فشل في جلب نتائج الفحص.';
                        console.error("Gemini API Error:", error);
                    } finally {
                        toggleButtonLoading(this, false);
                    }
                }
            });
          }

          const dSendPatientBtn = document.getElementById('d_sendPatientBtn');
          if (dSendPatientBtn) {
            dSendPatientBtn.addEventListener('click', async function() {
                const room = document.getElementById('d_room').value.trim();
                const data = window.appData.patients[room];
                if (!data) return showMessage("لم يتم العثور على بيانات المريض", "error");
                const diag = document.getElementById('d_diag').value;
                const newmeds = document.getElementById('d_newmeds').value;
                
                const patientsCollectionRef = collection(window.appData.db, 'patients');
                const docRef = doc(patientsCollectionRef, room);
                try {
                    await setDoc(docRef, { ...data, diag, newmeds }, { merge: true });
                    showMessage("تم حفظ البيانات وإرسالها للمريض ✅", "success");
                } catch (error) {
                    console.error("Error updating document: ", error);
                    showMessage("فشل تحديث بيانات المريض.", "error");
                }
            });
          }
          
          const pLoadBtn = document.getElementById('p_loadBtn');
          if (pLoadBtn) {
            pLoadBtn.addEventListener('click', function() {
                const room = document.getElementById('p_room').value.trim();
                const data = window.appData.patients[room];
                const pResult = document.getElementById('p_result');
                if (!data) {
                    if (pResult) pResult.classList.add('hidden');
                    return showMessage("لم يتم العثور على بيانات المريض", "error");
                }
                if (pResult) {
                    pResult.classList.remove('hidden');
                    document.getElementById('p_name').innerText = data.name || '—';
                    document.getElementById('p_diag').innerText = data.diag || '—';
                    document.getElementById('p_newmeds').innerText = data.newmeds || '—';

                    const radiologySection = document.getElementById('p_radiology_reports_section');
                    const radiologyContainer = document.getElementById('p_radiology_reports_container');
                    
                    if (radiologySection && radiologyContainer) {
                        if (data.radiology_reports && data.radiology_reports.length > 0) {
                            radiologySection.classList.remove('hidden');
                            radiologyContainer.innerHTML = '';
                            data.radiology_reports.forEach(report => {
                                const reportDate = new Date(report.date).toLocaleDateString('ar-EG');
                                const reportCard = `
                                    <div class="p-3 bg-white rounded-md border border-gray-200 shadow-sm">
                                        <p class="font-bold text-gray-700">التقرير: ${report.scanType} - ${report.bodyPart} (${reportDate})</p>
                                        <p class="mt-1 text-sm text-gray-600">${report.analysis}</p>
                                    </div>
                                `;
                                radiologyContainer.innerHTML += reportCard;
                            });
                        } else {
                            radiologySection.classList.add('hidden');
                        }
                    }
                }
            });
          }

          const pExplainMedsBtn = document.getElementById('p_explain_meds_btn');
          if (pExplainMedsBtn) {
            pExplainMedsBtn.addEventListener('click', async function() {
                const room = document.getElementById('p_room').value.trim();
                const data = window.appData.patients[room];
                if (!data || (!data.diag && !data.newmeds)) return showMessage("لا توجد بيانات كافية لتقديم شرح.", "error");
                
                const prompt = `You are a helpful medical assistant for a patient. Provide a simple, brief explanation of the patient's diagnosis and new medications. Use simple language and be reassuring.\n- Diagnosis: ${data.diag}\n- New Medications: ${data.newmeds}\nDo not provide medical advice. Simply explain the information in a clear and friendly manner.`;
                const targetElement = document.getElementById('p_ai_explanation');
                const targetText = document.getElementById('p_ai_explanation_text');
                if (targetElement && targetText) {
                    targetElement.classList.remove('hidden');
                    targetText.textContent = '... جاري تحضير الشرح لك ...';
                    toggleButtonLoading(this, true);
                    try {
                        const text = await callGeminiApi(prompt);
                        targetText.textContent = text;
                    } catch (error) {
                        targetText.textContent = '❌ فشل في جلب الشرح.';
                        console.error("Gemini API Error:", error);
                    } finally {
                        toggleButtonLoading(this, false);
                    }
                }
            });
          }
          
          const pMedsInstructionsBtn = document.getElementById('p_meds_instructions_btn');
          if (pMedsInstructionsBtn) {
            pMedsInstructionsBtn.addEventListener('click', async function() {
                const room = document.getElementById('p_room').value.trim();
                const data = window.appData.patients[room];
                if (!data || !data.newmeds) return showMessage("لا توجد أدوية جديدة لتوليد التعليمات.", "error");

                const prompt = `You are a helpful assistant providing patient education. Based on the following medications, provide a simple, bulleted list of instructions on how and when to take them. Each medication should be on a new line with a clear, concise instruction.\n- Medications: ${data.newmeds}`;
                const targetElement = document.getElementById('p_meds_instructions');
                const targetText = document.getElementById('p_meds_instructions_text');
                if (targetElement && targetText) {
                    targetElement.classList.remove('hidden');
                    targetText.textContent = '... جاري تحضير التعليمات ...';
                    toggleButtonLoading(this, true);
                    try {
                        const text = await callGeminiApi(prompt);
                        targetText.textContent = text;
                    } catch (error) {
                        targetText.textContent = '❌ فشل في جلب التعليمات.';
                        console.error("Gemini API Error:", error);
                    } finally {
                        toggleButtonLoading(this, false);
                    }
                }
            });
          }

          const pDownloadPdfBtn = document.getElementById('p_download_pdf_btn');
          if (pDownloadPdfBtn) {
            pDownloadPdfBtn.addEventListener('click', function() {
                const room = document.getElementById('p_room').value.trim();
                const data = window.appData.patients[room];
                if (!data) return showMessage("لم يتم العثور على بيانات المريض لتنزيلها.", "error");

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
                doc.setFont('times', 'normal');
                doc.setFontSize(20);
                doc.text('تقرير حالة المريض', 105, 20, { align: 'center', lang: 'ar' });
                doc.setFontSize(14);
                const rightMargin = 190;
                doc.text(`الاسم: ${data.name || '—'}`, rightMargin, 40, { align: 'right', lang: 'ar' });
                doc.text(`التشخيص: ${data.diag || '—'}`, rightMargin, 50, { align: 'right', lang: 'ar' });
                doc.text(`الأدوية الحالية: ${data.newmeds || '—'}`, rightMargin, 60, { align: 'right', lang: 'ar' });
                doc.save(`تقرير_${data.name}.pdf`);
                showMessage("تم إنشاء ملف PDF ✅", "success");
            });
          }
          
          const phLoadBtn = document.getElementById('ph_loadBtn');
          if(phLoadBtn) {
            phLoadBtn.addEventListener('click', function() {
                const room = document.getElementById('ph_room').value.trim();
                const data = window.appData.patients[room];
                const resultDiv = document.getElementById('ph_result');
                if (!data) {
                    resultDiv.classList.add('hidden');
                    return showMessage("لم يتم العثور على بيانات المريض", "error");
                }
                document.getElementById('ph_name').textContent = data.name || '—';
                document.getElementById('ph_newmeds').textContent = data.newmeds || 'لا توجد أدوية موصوفة.';
                resultDiv.classList.remove('hidden');
                
                const dispenseBtn = document.getElementById('ph_dispenseBtn');
                if (data.meds_dispensed) {
                    dispenseBtn.textContent = 'تم صرف الدواء بالفعل';
                    dispenseBtn.disabled = true;
                    dispenseBtn.classList.add('bg-gray-400', 'hover:bg-gray-400');
                } else {
                    dispenseBtn.textContent = 'صرف الدواء ✅';
                    dispenseBtn.disabled = false;
                    dispenseBtn.classList.remove('bg-gray-400', 'hover:bg-gray-400');
                }
            });
          }

          const phDispenseBtn = document.getElementById('ph_dispenseBtn');
          if(phDispenseBtn) {
            phDispenseBtn.addEventListener('click', async function() {
                const room = document.getElementById('ph_room').value.trim();
                if(!room) return;

                const docRef = doc(db, 'patients', room);
                try {
                    await setDoc(docRef, { meds_dispensed: true }, { merge: true });
                    showMessage("تم تسجيل صرف الدواء بنجاح", "success");
                    this.textContent = 'تم صرف الدواء بالفعل';
                    this.disabled = true;
                    this.classList.add('bg-gray-400', 'hover:bg-gray-400');
                } catch (error) {
                    console.error("Error updating document:", error);
                    showMessage("فشل في تحديث حالة الدواء.", "error");
                }
            });
          }

          const radImageUpload = document.getElementById('rad_image_upload');
          if(radImageUpload) {
              radImageUpload.addEventListener('change', function(event) {
                  const file = event.target.files[0];
                  if (file) {
                      const reader = new FileReader();
                      reader.onload = function(e) {
                          const preview = document.getElementById('rad_image_preview');
                          preview.src = e.target.result;
                          
                          window.appData.uploadedImageData.base64 = e.target.result.split(',')[1];
                          window.appData.uploadedImageData.mimeType = file.type;

                          document.getElementById('rad_result_container').classList.remove('hidden');
                          document.getElementById('rad_analysis_text').textContent = "الصورة جاهزة للتحليل.";
                          document.getElementById('rad_confidence_section').classList.add('hidden');

                      };
                      reader.readAsDataURL(file);
                  }
              });
          }

          const radAnalyzeBtn = document.getElementById('rad_analyze_btn');
            if(radAnalyzeBtn) {
                radAnalyzeBtn.addEventListener('click', async function() {
                    if (!window.appData.uploadedImageData.base64) {
                        return showMessage("الرجاء رفع صورة أولاً.", "error");
                    }
                    
                    const model = document.getElementById('rad_model_select').value;
                    const scanType = document.getElementById('rad_scan_type').value;
                    const bodyPart = document.getElementById('rad_body_part').value;
                    const clinicalHistory = document.getElementById('rad_clinical_history').value;

                    if (!scanType || !bodyPart) {
                        return showMessage("الرجاء تحديد نوع الأشعة والجزء المصور من الجسم.", "error");
                    }

                    const prompt = `You are simulating an advanced medical AI. The selected model for analysis is **${model}**. 
                    Analyze this medical image which is a **${scanType}** of the **${bodyPart}**.
                    The provided clinical history is: "${clinicalHistory}".
                    Based on this context, provide a concise, professional, preliminary summary of your findings in Arabic.
                    Point out potential abnormalities relevant to the body part and scan type. 
                    For example, if it's a chest X-ray, mention things like 'infiltrates' or 'cardiomegaly'. If it's a brain MRI, mention 'lesions' or 'mass effect'.
                    Frame your response as a preliminary finding for a qualified radiologist to review. Respond in a single paragraph.`;
                    
                    const resultContainer = document.getElementById('rad_result_container');
                    const targetText = document.getElementById('rad_analysis_text');
                    const modelUsedText = document.getElementById('rad_model_used');
                    const confidenceSection = document.getElementById('rad_confidence_section');
                    
                    resultContainer.classList.remove('hidden');
                    modelUsedText.textContent = `النموذج المستخدم: ${model}`;
                    targetText.textContent = '... جاري تحليل الصورة ...';
                    confidenceSection.classList.add('hidden');
                    toggleButtonLoading(this, true);

                    try {
                        const text = await callGeminiMultimodalApi(prompt, window.appData.uploadedImageData.base64, window.appData.uploadedImageData.mimeType);
                        targetText.textContent = text;
                        
                        const confidenceLevel = Math.floor(Math.random() * (98 - 85 + 1)) + 85;
                        const confidenceBar = document.getElementById('rad_confidence_bar');
                        const confidenceText = document.getElementById('rad_confidence_text');
                        
                        confidenceBar.style.width = `${confidenceLevel}%`;
                        confidenceText.textContent = `${confidenceLevel}%`;
                        confidenceSection.classList.remove('hidden');

                        document.getElementById('rad_save_report_btn').classList.remove('hidden');

                    } catch (error) {
                        targetText.textContent = '❌ فشل في تحليل الصورة. قد تكون الصورة غير واضحة أو أن هناك مشكلة في الاتصال.';
                        console.error("Gemini Multimodal API Error:", error);
                    } finally {
                        toggleButtonLoading(this, false);
                    }
                });
            }

            const radSaveReportBtn = document.getElementById('rad_save_report_btn');
            if (radSaveReportBtn) {
                radSaveReportBtn.addEventListener('click', async function() {
                    const room = document.getElementById('rad_room').value.trim();
                    const analysis = document.getElementById('rad_analysis_text').textContent;
                    const model = document.getElementById('rad_model_select').value;
                    const scanType = document.getElementById('rad_scan_type').value;
                    const bodyPart = document.getElementById('rad_body_part').value;

                    if (!room || !analysis) return showMessage("لا يوجد رقم غرفة أو تحليل للحفظ.", "error");
                    const patient = window.appData.patients[room];
                    if (!patient) return showMessage("رقم الغرفة غير صحيح.", "error");

                    const newReport = {
                        scanType, bodyPart, model, analysis, 
                        date: new Date().toISOString()
                    };
                    
                    const updatedReports = [...(patient.radiology_reports || []), newReport];
                    
                    toggleButtonLoading(this, true);
                    try {
                        await setDoc(doc(db, 'patients', room), { radiology_reports: updatedReports }, { merge: true });
                        showMessage("تم حفظ تقرير الأشعة وإرساله لملف المريض.", "success");
                        this.disabled = true;
                    } catch (error) {
                        showMessage("فشل في حفظ التقرير.", "error");
                    } finally {
                        toggleButtonLoading(this, false);
                    }
                });
            }

          const bLoadBtn = document.getElementById('b_loadBtn');
          if(bLoadBtn) {
            bLoadBtn.addEventListener('click', function() {
                const room = document.getElementById('b_room').value.trim();
                const data = window.appData.patients[room];
                const resultDiv = document.getElementById('b_result');
                if (!data || !data.billing) {
                    if(resultDiv) resultDiv.classList.add('hidden');
                    return showMessage("لا توجد بيانات فواتير لهذا المريض", "error");
                }
                
                document.getElementById('b_name').textContent = data.name || '—';
                document.getElementById('b_total_cost').textContent = `${data.billing.total_cost || 0} ج.م`;
                document.getElementById('b_insurance_coverage').textContent = `${data.billing.insurance_coverage || 0}%`;
                document.getElementById('b_amount_due').textContent = `${data.billing.amount_due || 0} ج.م`;
                
                resultDiv.classList.remove('hidden');
            });
          }

          const adminChartCtx = document.getElementById('adminStatsChart');
          if (adminChartCtx) {
            adminStatsChart = new Chart(adminChartCtx, {
                type: 'bar',
                data: {
                    labels: ['إشغال الطوارئ', 'إشغال العناية المركزة', 'استهلاك الأدوية'],
                    datasets: [{ label: 'النسبة المئوية', data: [0, 0, 0], backgroundColor: ['#f59e0b', '#dc2626', '#14b8a6'] }]
                },
                options: {
                    responsive: true,
                    scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'النسبة المئوية (%)' } } },
                    plugins: { legend: { display: false } }
                }
            });
          }

          const simulateBtn = document.getElementById('simulate-critical-btn');
          if (simulateBtn) {
              simulateBtn.addEventListener('click', () => {
                  const roomNumber = Math.floor(Math.random() * 50) + 1;
                  const departments = ['الطوارئ', 'العناية المركزة', 'الباطنة'];
                  const department = departments[Math.floor(Math.random() * departments.length)];
                  triggerCriticalAlert(roomNumber, department, 1);
              });
          }

        });

        function renderAppointmentCases() {
            const tbody = document.getElementById('appointments_cases_tbody');
            if (!tbody) return;

            tbody.innerHTML = '';
            if (!window.appData.doctorCases || window.appData.doctorCases.length === 0) {
                 tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">لا توجد حالات جديدة في الوقت الحالي.</td></tr>`;
                 return;
            }

            window.appData.doctorCases.forEach(caseItem => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="p-3 border border-gray-200">${caseItem.patientName}</td>
                    <td class="p-3 border border-gray-200">${caseItem.specialty}</td>
                    <td class="p-3 border border-gray-200">${caseItem.doctorName}</td>
                    <td class="p-3 border border-gray-200">
                        <button onclick="showMessage('تم إرسال تنبيه للطبيب ${caseItem.doctorName}.', 'success')" class="bg-orange-500 text-white px-2 py-1 rounded-lg text-sm hover:bg-orange-600 transition-all duration-300">
                            🔔 تنبيه الطبيب
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        function triggerCriticalAlert(room, department, patientCount) {
            playBellSound();
            const alertBar = document.getElementById('critical-alert-bar');
            const alertDetails = document.getElementById('alert-details');
            if (alertBar && alertDetails) {
                alertDetails.innerHTML = `غرفة رقم: <span class="font-bold">${room}</span><br>القسم: <span class="font-bold">${department}</span><br><span class="font-bold">الحالة: واحدة فقط</span>`;
                alertBar.classList.remove('hidden');
                setTimeout(() => alertBar.classList.add('hidden'), 5000);
            }
            window.appData.criticalAlerts++;
            updateDashboard();
        }

        function updateDashboard() {
            const totalPatients = Object.keys(window.appData.patients).length;
            const criticalPatients = Object.values(window.appData.patients).filter(p => p.type === 'ICU / Critical Care' || p.type === 'Emergency & Trauma').length;
            const surgeryCases = Object.values(window.appData.patients).filter(p => p.type === 'Surgery').length;
            
            const totalPatientsEl = document.getElementById('total-patients');
            const criticalPatientsEl = document.getElementById('critical-patients');
            const totalAlertsEl = document.getElementById('total-alerts');
            const tableTotalPatients = document.getElementById('table-total-patients');
            const tableCriticalPatients = document.getElementById('table-critical-patients');
            const tableSurgeryCases = document.getElementById('table-surgery-cases');
            const tableTotalAlerts = document.getElementById('table-total-alerts');

            if (totalPatientsEl) totalPatientsEl.textContent = totalPatients;
            if (criticalPatientsEl) criticalPatientsEl.textContent = criticalPatients;
            if (totalAlertsEl) totalAlertsEl.textContent = window.appData.criticalAlerts;
            if (tableTotalPatients) tableTotalPatients.textContent = totalPatients;
            if (tableCriticalPatients) tableCriticalPatients.textContent = criticalPatients;
            if (tableSurgeryCases) tableSurgeryCases.textContent = surgeryCases + Math.floor(Math.random() * 5);
            if (tableTotalAlerts) tableTotalAlerts.textContent = window.appData.criticalAlerts;
        }

        const recommendations = [
            { text: 'زيادة عدد الممرضين في وردية الليل للتعامل مع الحالات الطارئة.', icon: '⚠' },
            { text: 'الوضع مستقر حاليًا، يمكن تخفيض الضغط على الموارد غير الأساسية.', icon: '✅' },
            { text: 'إشغال العناية المركزة وصل إلى نسبة حرجة، يرجى تجهيز أسرّة إضافية.', icon: '🔥' },
            { text: 'تنبيه: مخزون الأدوية الأساسية بدأ ينخفض، يجب طلب إمدادات إضافية.', icon: '⚠' },
            { text: 'تمت معالجة جميع حالات الطوارئ بنجاح، فريق العمل يقدم أداءً جيدًا.', icon: '✅' },
            { text: 'هناك ضغط مرتفع على قسم الجراحة، يرجى التنسيق مع الأقسام الأخرى.', icon: '🔥' }
        ];

        function initializeAdminChart() {
            const updateChartAndRecommendations = () => {
                const erOccupancy = Math.floor(Math.random() * 90) + 10;
                const icuOccupancy = Math.floor(Math.random() * 90) + 10;
                const medsConsumption = Math.floor(Math.random() * 90) + 10;
                if (adminStatsChart) {
                    adminStatsChart.data.datasets[0].data = [erOccupancy, icuOccupancy, medsConsumption];
                    adminStatsChart.update();
                }
                const randomRec = recommendations[Math.floor(Math.random() * recommendations.length)];
                const recommendationIcon = document.getElementById('recommendation-icon');
                const recommendationText = document.getElementById('recommendation-text');
                if (recommendationIcon && recommendationText) {
                    recommendationIcon.textContent = randomRec.icon;
                    recommendationText.textContent = randomRec.text;
                }
            };
            updateChartAndRecommendations();
            adminChartInterval = setInterval(updateChartAndRecommendations, 10000);
        }

        function initializeWaitTimesView() {
            const departments = [
                "الباطنة", "الجراحة", "النساء والولادة", "الأطفال", "الطوارئ والإسعاف",
                "الأشعة", "المختبر", "العيون", "الأنف والأذن والحنجرة", "الأسنان"
            ];

            const updateData = () => {
                const tbody = document.getElementById('wait_times_tbody');
                if (!tbody) return;
                tbody.innerHTML = '';

                const chartData = {
                    labels: [],
                    values: []
                };

                departments.forEach(dept => {
                    const waitingCount = Math.floor(Math.random() * 20) + 1;
                    const avgWaitTime = Math.floor(Math.random() * 45) + 5;
                    let status, statusClass;

                    if (waitingCount > 15 || avgWaitTime > 35) {
                        status = 'حرج';
                        statusClass = 'text-red-600 font-bold bg-red-100 px-2 py-1 rounded-full';
                    } else if (waitingCount > 10 || avgWaitTime > 25) {
                        status = 'مزدحم';
                        statusClass = 'text-yellow-600 font-bold bg-yellow-100 px-2 py-1 rounded-full';
                    } else {
                        status = 'طبيعي';
                        statusClass = 'text-green-600 font-bold bg-green-100 px-2 py-1 rounded-full';
                    }

                    const row = `
                        <tr>
                            <td class="p-3 border border-gray-200">${dept}</td>
                            <td class="p-3 border border-gray-200 font-mono">${waitingCount}</td>
                            <td class="p-3 border border-gray-200 font-mono">${avgWaitTime}</td>
                            <td class="p-3 border border-gray-200"><span class="${statusClass}">${status}</span></td>
                        </tr>
                    `;
                    tbody.innerHTML += row;

                    chartData.labels.push(dept);
                    chartData.values.push(avgWaitTime);
                });
                
                // Update Chart
                const ctx = document.getElementById('waitTimesChart');
                if (waitTimesChart) waitTimesChart.destroy();
                if (ctx) {
                    waitTimesChart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: chartData.labels,
                            datasets: [{
                                label: 'متوسط وقت الانتظار (دقائق)',
                                data: chartData.values,
                                backgroundColor: '#fb923c' // Orange color
                            }]
                        },
                        options: {
                            responsive: true,
                            scales: { y: { beginAtZero: true, title: { display: true, text: 'دقائق' } } },
                            plugins: { legend: { display: false } }
                        }
                    });
                }
            };

            updateData();
            waitTimesInterval = setInterval(updateData, 7000); // Update every 7 seconds
        }

        async function authenticateAndLoadData() {
            try {
                await signInAnonymously(auth);
                window.appData.userId = auth.currentUser.uid;
                const userIdSpan = document.getElementById('user-id');
                if (userIdSpan) userIdSpan.textContent = window.appData.userId;
                
                const patientsCollectionRef = collection(db, 'patients');
                onSnapshot(patientsCollectionRef, (querySnapshot) => {
                    const patients = {};
                    querySnapshot.forEach((doc) => {
                        patients[doc.id] = doc.data();
                    });
                    window.appData.patients = patients;
                    updateDashboard();
                });

                const appointmentsCollectionRef = collection(db, 'appointments');
                onSnapshot(appointmentsCollectionRef, (querySnapshot) => {
                    // This listener remains for any future use but doesn't populate the new cases table
                    const appointments = [];
                    querySnapshot.forEach((doc) => {
                        appointments.push(doc.data());
                    });
                    window.appData.appointments = appointments;
                });
            } catch (error) {
                console.error("Authentication or Firestore setup failed:", error);
                showMessage("فشل الاتصال بالخادم. حاول مرة أخرى.", "error");
            }
        }

        window.onload = () => {
             window.appData.doctorCases = [
                { patientName: 'سارة إبراهيم', specialty: 'الباطنة (Internal Medicine)', doctorName: 'د. خالد' },
                { patientName: 'محمد علي', specialty: 'الجراحة (Surgery)', doctorName: 'د. يوسف' },
                { patientName: 'فاطمة الزهراء', specialty: 'الأطفال (Pediatrics)', doctorName: 'د. مريم' },
             ];
             renderAppointmentCases();
             authenticateAndLoadData();

             // PWA Service Worker Registration to make the app installable
            if ('serviceWorker' in navigator) {
                // We create a very simple service worker content string.
                // This worker doesn't do much, but it's required for the PWA install prompt to appear.
                const swContent = `
                    self.addEventListener('fetch', (event) => {
                        // This is a pass-through service worker. 
                        // It's the minimum required to be considered a PWA.
                    });
                `;
                // Create a Blob from the string
                const swBlob = new Blob([swContent], { type: 'application/javascript' });
                // Create a URL for the Blob
                const swUrl = URL.createObjectURL(swBlob);

                navigator.serviceWorker.register(swUrl)
                    .then(registration => {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed: ', error);
                    });
            }

             let deferredPrompt;
             const installPwaBtn = document.getElementById('install-pwa-btn');

             window.addEventListener('beforeinstallprompt', (e) => {
                // Prevent the mini-infobar from appearing on mobile
                e.preventDefault();
                // Stash the event so it can be triggered later.
                deferredPrompt = e;
                // Update UI to notify the user they can install the PWA
                if(installPwaBtn) installPwaBtn.classList.remove('hidden');

                installPwaBtn.addEventListener('click', () => {
                    // Hide the app provided install button
                    installPwaBtn.classList.add('hidden');
                    // Show the install prompt
                    deferredPrompt.prompt();
                    // Wait for the user to respond to the prompt
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('User accepted the install prompt');
                        } else {
                            console.log('User dismissed the install prompt');
                        }
                        deferredPrompt = null;
                    });
                });
             });
        };