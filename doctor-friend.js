        // ======= متغيرات عامة ======
        let userId = 'user-offline-12345'; // معرف ثابت لأن المصادقة معطلة
        let currentTheme = 'dark';
        let currentView = 'Notes';

        // مفتاح Gemini API الخاص بالمستخدم
        const API_KEY = "AIzaSyAXxYhIiAVaEJUXlWr5tnXiybAPB98t1Y8"; 

        // تم إزالة جميع متغيرات Firebase (db, auth, firebaseConfig, etc.) بناءً على طلبك.

        // =========================================================================
        // ======= وظائف واجهة المستخدم (UI Functions) ==============================
        // =========================================================================

        /**
         * تبديل الثيم بين الفاتح والداكن.
         */
        function toggleTheme() {
            const body = document.body;
            const themeIcon = document.getElementById('theme-icon');
            
            if (currentTheme === 'light') {
                currentTheme = 'dark';
                body.className = 'theme-dark';
                themeIcon.className = 'ph-fill ph-moon text-2xl';
            } else {
                currentTheme = 'light';
                body.className = 'theme-light';
                themeIcon.className = 'ph-fill ph-sun-dim text-2xl';
            }
            updateViewClasses(currentTheme);
        }

        /**
         * تحديث فئات CSS الخاصة بالتنقل النشط.
         */
        function updateViewClasses(theme) {
            document.querySelectorAll('.nav-item').forEach(el => {
                el.classList.remove('nav-item-active', 'font-bold');
                
                if (el.id === `nav-${currentView}`) {
                    el.classList.add('nav-item-active', 'font-bold');
                }
            });
        }

        /**
         * تبديل عرض القسم بين الملاحظات، المكتبة، والحالات المشابهة.
         */
        function switchView(viewName) {
            currentView = viewName;
            document.querySelectorAll('.view-content').forEach(el => el.classList.add('hidden'));
            document.getElementById(`${viewName}View`).classList.remove('hidden');

            updateViewClasses(currentTheme);
        }

        /**
         * عرض رسالة مؤقتة للمستخدم (بدلاً من alert()).
         */
        function showGlobalMessage(message, type = 'success') {
            const box = document.getElementById('globalMessage');
            let bgColor = '';
            let textColor = '';

            switch (type) {
                case 'error':
                    bgColor = 'bg-red-600';
                    textColor = 'text-white';
                    break;
                case 'info':
                    bgColor = 'bg-blue-600';
                    textColor = 'text-white';
                    break;
                case 'success':
                default:
                    bgColor = 'bg-green-600';
                    textColor = 'text-white';
            }

            box.className = `fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl z-50 transition-all duration-300 opacity-100 ${bgColor} ${textColor} text-right`;
            box.innerHTML = `<p class="font-bold">${message}</p>`;
            box.classList.remove('hidden');

            setTimeout(() => {
                box.classList.remove('opacity-100');
                box.classList.add('opacity-0');
                setTimeout(() => box.classList.add('hidden'), 300);
            }, 3000);
        }

        /**
         * فتح المودال لعرض نتائج معالجة LLM.
         */
        function openLlmModal(originalContent, actionLabel) {
            document.getElementById('modalTitle').textContent = `✨ معالجة الملاحظة: ${actionLabel}`;
            document.getElementById('resultTypeLabel').textContent = actionLabel;
            document.getElementById('originalNoteContent').value = originalContent;
            document.getElementById('processedOutput').innerHTML = 'الرجاء اختيار عملية (تلخيص أو تنقيح).';
            document.getElementById('modalLoading').classList.add('hidden');
            document.getElementById('modalContentDiv').classList.remove('hidden');
            document.getElementById('llmModal').classList.remove('hidden', 'opacity-0');
            document.getElementById('llmModal').classList.add('opacity-100');
        }

        /**
         * إغلاق المودال.
         */
        function closeLlmModal() {
            document.getElementById('llmModal').classList.remove('opacity-100');
            document.getElementById('llmModal').classList.add('opacity-0');
            setTimeout(() => document.getElementById('llmModal').classList.add('hidden'), 300);
        }
        
        /**
         * نسخ المحتوى من عنصر معين إلى الحافظة.
         */
        function copyToClipboard(elementId) {
            const content = document.getElementById(elementId).innerText.trim();
            if (content) {
                const tempInput = document.createElement('textarea');
                tempInput.value = content;
                document.body.appendChild(tempInput);
                tempInput.select();
                try {
                    document.execCommand('copy');
                    showGlobalMessage('تم نسخ النص بنجاح إلى الحافظة.', 'success');
                } catch (err) {
                    console.error('Copy failed:', err);
                    showGlobalMessage('فشل النسخ إلى الحافظة.', 'error');
                }
                document.body.removeChild(tempInput);
            }
        }


        // =========================================================================
        // ======= وظائف Firebase/Auth/Init (تم إزالة Firebase) ====================
        // =========================================================================

        window.onload = function () {
            // يتم تخطي تهيئة Firebase والبدء فوراً
            document.getElementById('user-id-placeholder').textContent = userId + ' (بدون حفظ دائم)';
            hideLoadingScreen(false);
            switchView('Notes');
            renderNotes([]); // عرض قائمة ملاحظات فارغة مع رسالة
            showGlobalMessage("تم تعطيل وظيفة الحفظ الدائم للملاحظات (Firebase).", 'info');
        };

        /**
         * إخفاء شاشة التحميل السينمائية بعد انتهاء عملية التهيئة.
         */
        function hideLoadingScreen(immediate = false) {
            const loadingScreen = document.getElementById('loading-screen');
            if (immediate) {
                loadingScreen.classList.add('hidden');
                return;
            }

            // تأخير إضافي لضمان عرض الحركة السينمائية (1.5 ثانية للحركة + 0.5 ثانية إضافية)
            setTimeout(() => {
                loadingScreen.classList.add('opacity-0');
                // بعد 1 ثانية من الانتقال، يتم إخفاء العنصر بالكامل
                setTimeout(() => loadingScreen.classList.add('hidden'), 1000); 
            }, 2000); 
        }

        // =========================================================================
        // ======= قسم الملاحظات (Notes - تم تعطيل الحفظ) ===========================
        // =========================================================================
        
        function setupNotesListener() {
             // وظيفة معطلة بعد إزالة Firebase
        }
        
        async function addNote() {
            const titleEl = document.getElementById('noteTitle');
            const contentEl = document.getElementById('noteContent');
            const reminderEl = document.getElementById('noteReminder');

            const title = titleEl.value.trim();
            const content = contentEl.value.trim();

            if (!title || !content) {
                showGlobalMessage("الرجاء إدخال عنوان ومحتوى للملاحظة.", 'info');
                return;
            }

            showGlobalMessage("تم تعطيل ميزة الحفظ الدائم للملاحظة. الملاحظة لم تُحفظ.", 'error');

            // مسح الحقول بعد "محاولة" الإضافة
            titleEl.value = '';
            contentEl.value = '';
            reminderEl.checked = false;
        }

        async function deleteNote(id) {
             showGlobalMessage("تم تعطيل ميزة حذف الملاحظة. لا توجد ملاحظات محفوظة حالياً.", 'error');
        }

        function renderNotes(notes) {
            const list = document.getElementById('notesList');
            list.innerHTML = '';
            
            // عند تعطيل Firebase، يتم عرض هذه الرسالة فقط
            list.innerHTML = `
                <div class="md:col-span-2 lg:col-span-3 text-center p-8 rounded-xl card-bg border-2 border-red-400/50 shadow-inner">
                    <i class="ph ph-database text-6xl text-red-500 mb-4"></i>
                    <p class="text-xl font-bold text-red-500">ميزة الحفظ (Firestore) غير مفعلة.</p>
                    <p class="text-sm text-gray-500 mt-2">لا يمكن عرض أو حفظ الملاحظات بشكل دائم حالياً.</p>
                </div>
            `;
            updateViewClasses(currentTheme); 
        }

        async function processNoteLlm(content, type, actionLabel) {
            if (content.length < 10) {
                 showGlobalMessage("الملاحظة قصيرة جداً للمعالجة. تحتاج إلى أكثر من 10 أحرف.", 'info');
                 return;
            }
            
            openLlmModal(content, actionLabel);
            document.getElementById('modalContentDiv').classList.add('hidden');
            document.getElementById('modalLoading').classList.remove('hidden');

            let systemPrompt = '';
            let resultTitle = '';

            if (type === 'summarize') {
                resultTitle = 'النتيجة: تلخيص نقطي موجز (5 نقاط كحد أقصى)';
                systemPrompt = `أنت مساعد طبي ذكي. مهمتك تلخيص النص الطبي التالي في شكل قائمة نقطية (Bullet Points) موجزة ومترابطة. يجب أن تكون النقاط دقيقة ولا تزيد عن 5 نقاط.`;
            } else if (type === 'refine') {
                resultTitle = 'النتيجة: صياغة احترافية ومنقحة لتوثيق رسمي';
                systemPrompt = `أنت محرر تقارير طبية محترف. مهمتك هي تنقيح وتحسين النص الطبي التالي. يجب أن تكون الصياغة رسمية، واضحة، وخالية من الأخطاء، ومناسبة لتقرير سريري. أعد صياغة كل المحتوى بنبرة موثوقة.`;
            } else if (type === 'soap') {
                 resultTitle = 'النتيجة: هيكل SOAP مُنظم وجاهز للتوثيق';
                 systemPrompt = `أنت متخصص في توثيق السجلات الطبية. مهمتك هي تحليل الملاحظات الأولية التالية وتنظيمها في هيكل SOAP (Subjective, Objective, Assessment, Plan) القياسي. 
                 قم بتسمية كل قسم بوضوح: **S (المعلومات الذاتية):**، **O (المعلومات الموضوعية):**، **A (التقييم):**، **P (الخطة):**. 
                 استنبط المحتوى من الملاحظات بدقة.`;
            }

            const { text } = await fetchGeminiResponse({
                userQuery: content,
                systemPrompt: systemPrompt,
                useSearch: false 
            });

            document.getElementById('modalLoading').classList.add('hidden');
            document.getElementById('modalContentDiv').classList.remove('hidden');
            
            const processedOutput = document.getElementById('processedOutput');
            processedOutput.innerHTML = `<p class="font-bold border-b pb-1 mb-2 text-cyan-600">${resultTitle}</p>` + formatMarkdownToHtml(text);
        }

        // =========================================================================
        // ======= وظائف الذكاء الاصطناعي (Gemini API) ==============================
        // =========================================================================
        
        async function fetchGeminiResponse({ userQuery, systemPrompt, useSearch = false }) {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;
            
            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
            };

            if (useSearch) {
                payload.tools = [{ "google_search": {} }];
            }

            try {
                for (let i = 0; i < 3; i++) {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (response.status === 429 && i < 2) { 
                        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }

                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                    const result = await response.json();
                    const candidate = result.candidates?.[0];

                    if (candidate && candidate.content?.parts?.[0]?.text) {
                        const text = candidate.content.parts[0].text;
                        let sources = [];
                        const groundingMetadata = candidate.groundingMetadata;
                        
                        if (groundingMetadata && groundingMetadata.groundingAttributions) {
                            sources = groundingMetadata.groundingAttributions
                                .map(attribution => ({
                                    uri: attribution.web?.uri,
                                    title: attribution.web?.title,
                                }))
                                .filter(source => source.uri && source.title);
                        }
                        
                        return { text, sources };
                    }
                    return { text: "تعذر الحصول على استجابة واضحة من النموذج.", sources: [] };
                }
                throw new Error("فشل بعد عدة محاولات.");
            } catch (error) {
                console.error("Gemini API Error:", error);
                return { text: `حدث خطأ أثناء الاتصال بالذكاء الاصطناعي: ${error.message}.`, sources: [] };
            }
        }

        /**
         * وظيفة مساعدة لعرض المصادر بشكل منسق.
         */
        function renderSources(sources, elementId) {
            const sourcesDiv = document.getElementById(elementId);
             if (sources.length > 0) {
                sourcesDiv.innerHTML = '<strong>المصادر الموثقة:</strong><ul class="list-disc pr-4 mt-2 space-y-1 text-gray-400">' + 
                    sources.map((s, index) => `<li><a href="${s.uri}" target="_blank" class="text-blue-400 hover:underline">${s.title || `مصدر رقم ${index + 1}`}</a></li>`).join('') + 
                    '</ul>';
            } else {
                sourcesDiv.innerHTML = '<strong>المصادر:</strong> تم توليد الإجابة بناءً على المعرفة العامة للنموذج.';
            }
        }


        // =========================================================================
        // ======= قسم المكتبة (Library - الكتاب الكامل) ============================
        // =========================================================================
        
        async function searchLibrary() {
            const query = document.getElementById('libraryQuery').value.trim();
            const resultDiv = document.getElementById('libraryResult');
            const outputDiv = document.getElementById('libraryOutput');
            const loadingDiv = document.getElementById('libraryLoading');
            const sourcesDiv = document.getElementById('librarySources');
            const bookTitleDisplay = document.getElementById('bookTitleDisplay');
            const bookAuthorDisplay = document.getElementById('bookAuthorDisplay');


            if (!query) {
                showGlobalMessage("الرجاء إدخال مصطلح للبحث في المكتبة.", 'info');
                return;
            }

            resultDiv.classList.add('hidden');
            loadingDiv.classList.remove('hidden');
            outputDiv.innerHTML = '';
            sourcesDiv.innerHTML = '';

            // نظام لطلب اسم كتاب ومؤلف ضخم ومحتوى شامل
            const systemPrompt = `
                أنت خبير طبي ومؤلف كتاب جامعي ضخم (Textbook). بناءً على المصطلح المحدد (${query})، يجب عليك أداء ما يلي:
                1. اختراع **عنوان كتاب** طبي ضخم وموثوق يناسب هذا الموضوع (مثلاً: موسوعة الأمراض الداخلية).
                2. اختراع **اسم مؤلف** خبير (مثلاً: د. ماجد السالم).
                3. كتابة **فصل كامل وشامل (بطول لا يقل عن 500 كلمة)** عن الموضوع.
                يجب أن تبدأ الإجابة بالصيغة:
                [العنوان: عنوان الكتاب الذي اخترعته]
                [المؤلف: اسم المؤلف الخبير الذي اخترعته]
                ثم تبدأ مباشرة بكتابة محتوى الفصل المفصل.
                يجب أن يكون المحتوى مقسماً إلى أقسام مثل: **المقدمة، علم الأمراض (Pathology)، التشخيص السريري، خطة العلاج المحدثة**.
            `;

            const { text, sources } = await fetchGeminiResponse({
                userQuery: `اكتب فصلاً كاملاً وشاملاً من كتاب عن: ${query}`,
                systemPrompt: systemPrompt,
                useSearch: true // تفعيل البحث لضمان حداثة المعلومات
            });

            loadingDiv.classList.add('hidden');
            resultDiv.classList.remove('hidden');

            // تحليل العنوان والمؤلف من النص
            const titleMatch = text.match(/\[العنوان:\s*(.*?)\]/);
            const authorMatch = text.match(/\[المؤلف:\s*(.*?)\]/);

            const title = titleMatch ? titleMatch[1].trim() : `محتوى طبي شامل عن ${query}`;
            const author = authorMatch ? authorMatch[1].trim() : `مُعد بواسطة الذكاء الاصطناعي`;
            
            // تنظيف النص الأصلي من علامات [العنوان:] و [المؤلف:]
            let cleanedText = text.replace(/\[العنوان:\s*.*?\]\n?/, '').replace(/\[المؤلف:\s*.*?\]\n?/, '').trim();
            
            bookTitleDisplay.textContent = title;
            bookAuthorDisplay.textContent = author;
            outputDiv.innerHTML = formatMarkdownToHtml(cleanedText);
            
            renderSources(sources, 'librarySources');
        }

        // =========================================================================
        // ======= قسم الحالات المشابهة (Cases - موثق) ==============================
        // =========================================================================
        
        async function analyzeSymptoms() {
            const symptoms = document.getElementById('symptomsInput').value.trim();
            const resultDiv = document.getElementById('casesResult');
            const outputDiv = document.getElementById('casesOutput');
            const loadingDiv = document.getElementById('casesLoading');
            const sourcesDiv = document.getElementById('casesSources');

            if (!symptoms) {
                showGlobalMessage("الرجاء إدخال الأعراض لتحليل الحالة.", 'info');
                return;
            }

            resultDiv.classList.add('hidden');
            loadingDiv.classList.remove('hidden');
            outputDiv.innerHTML = '';
            sourcesDiv.innerHTML = '';

            const systemPrompt = `
                أنت نظام ذكاء اصطناعي متخصص في تحليل الحالات السريرية والتشخيص التفريقي. مهمتك هي:
                1. تحديد قائمة من 3 إلى 5 تشخيصات تفريقية (Differential Diagnoses) محتملة بناءً على الأعراض.
                2. لكل تشخيص، اذكر: **اسم التشخيص** (كعنوان)، **نقاط التطابق مع الأعراض**، و **التوصيات التشخيصية التالية (الأشعة/التحاليل)**.
                3. يجب أن تكون جميع المعلومات مستندة إلى أحدث البيانات الطبية الموثقة.
                قدم الرد في شكل قائمة منظمة واضحة جداً مع استخدام **العناوين والنقاط النجمية**.
            `;

            const { text, sources } = await fetchGeminiResponse({
                userQuery: `الأعراض السريرية هي: ${symptoms}`,
                systemPrompt: systemPrompt,
                useSearch: true // تفعيل البحث لضمان وجود مصادر موثوقة للتشخيص
            });

            loadingDiv.classList.add('hidden');
            resultDiv.classList.remove('hidden');
            
            outputDiv.innerHTML = formatMarkdownToHtml(text);
            renderSources(sources, 'casesSources');
        }
        
        // =========================================================================
        // ======= وظائف مساعدة عامة (Utilities) ===================================
        // =========================================================================

        /**
         * وظيفة مساعدة لتحويل Markdown بسيط إلى HTML (للعرض المنظم).
         */
        function formatMarkdownToHtml(mdText) {
            let html = mdText;

            // 1. تحويل العناوين الكبيرة والمتوسطة (H3)
            html = html.replace(/###\s*(.*)/g, '<h3 class="text-xl font-bold mt-6 mb-2 text-blue-500">$1</h3>');

            // 2. تحويل العناوين الصغيرة (H4)
            html = html.replace(/####\s*(.*)/g, '<h4 class="text-lg font-semibold mt-4 mb-1 text-cyan-600">$1</h4>');

            // 3. تحويل النص الجريء (bold)
            html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            // 4. تحويل القوائم النقطية
            const listRegex = /^\*\s*(.*)/gm;
            if (listRegex.test(html)) {
                html = html.replace(listRegex, '<li class="mr-4">$1</li>');
                html = html.replace(/(<li.*<\/li>)/gs, '<ul>$1</ul>');
                html = html.replace(/<\/ul>\s*<ul>/g, ''); 
            }

            // 5. تحويل الأسطر الجديدة المتتالية إلى فقرات
            html = html.replace(/\n\n/g, '</p><p>');

            // 6. التفاف النص بفقرة في البداية
            if (!html.startsWith('<') && !html.startsWith('<h') && !html.startsWith('<ul')) {
                html = `<p>${html}</p>`;
            }
            
            // 7. تنظيف وإضافة فئة للقائمة
            html = html.replace(/<ul>/g, '<ul class="list-disc pr-6 space-y-1 mb-3">');

            return html;
        }


        // =========================================================================
        // ======= وظائف تهيئة البدء (Initial Setup) ===============================
        // =========================================================================
        
        switchView('Notes');
        // يتم تبديل الثيم إلى dark عند التهيئة لضمان التناسق البصري مع الـ cinematic intro
        document.body.className = 'theme-dark';
        currentTheme = 'dark';
        