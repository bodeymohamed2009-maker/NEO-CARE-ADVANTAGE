        // **********************************************
        // تعريف المتغيرات العامة
        // **********************************************
        let map;
        let userMarker;
        let hospitalMarkers = []; // لتخزين علامات المستشفيات وإدارتها
        let healthData = {}; // لتخزين البيانات الصحية المحفوظة مؤقتاً
        const initialMapCenter = { lat: 26.8206, lng: 30.8025 }; // مركز افتراضي لمصر

        // دالة يتم استدعاؤها بواسطة Google Maps API بعد تحميلها
        function initMap() {
            console.log("Google Maps API loaded.");
        }

        // **********************************************
        // منطق تبديل العرض
        // **********************************************
        function showView(viewName) {
            const views = {
                'dashboard': document.querySelector('[data-view="dashboard"]'),
                'form': document.querySelector('[data-view="form"]'),
                'map-search': document.querySelector('[data-view="map-search"]')
            };
            const backButton = document.getElementById('back-to-dashboard-button');
            const mainTitle = document.getElementById('main-title');

            Object.values(views).forEach(v => v.classList.add('hidden'));

            if (views[viewName]) {
                views[viewName].classList.remove('hidden');
                
                if (viewName === 'dashboard') {
                    backButton.classList.add('hidden');
                    // تم تحديث اسم التطبيق هنا
                    mainTitle.textContent = 'دكتور في جيبك';
                } else {
                    backButton.classList.remove('hidden');
                    // تم تحديث عنوان الصفحة الفرعية هنا
                    mainTitle.textContent = viewName === 'form' ? 'نموذج معلوماتك الصحية' : 'البحث عن مستشفى';
                }

                if (viewName === 'map-search') {
                    // تهيئة الخريطة فوراً عند فتح الصفحة
                    if (!map) initializeMapPlaceholder(initialMapCenter);
                }
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        // دالة لتهيئة الخريطة بمركز افتراضي (مظهر داكن)
        function initializeMapPlaceholder(center) {
             const mapStyles = [
                { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
                { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
                { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
                { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
                { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
                { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17202b' }] },
                { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] }
            ];
            
            if (document.getElementById('map') && typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
                const initialMessage = document.getElementById('initial-map-message');
                if (initialMessage) { initialMessage.remove(); }

                map = new google.maps.Map(document.getElementById('map'), {
                    center: center,
                    zoom: 6,
                    styles: mapStyles,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    streetViewControl: false
                });
            }
        }
        
        // **********************************************
        // منطق المستشفيات (Geolocation + Places API)
        // **********************************************
        
        // دالة البحث الفعلي عن المستشفيات القريبة
        function findNearbyHospitals(location) {
            const statusMessage = document.getElementById('status-message');
            const resultsList = document.getElementById('results-list');
            
            // مسح النتائج والعلامات السابقة
            resultsList.innerHTML = '';
            document.getElementById('hospital-results').classList.add('hidden');
            hospitalMarkers.forEach(marker => marker.setMap(null));
            hospitalMarkers = [];

            if (typeof google === 'undefined' || typeof google.maps.places === 'undefined') {
                statusMessage.textContent = 'خطأ في الخريطة: لم يتم تحميل مكتبة الأماكن (Places).';
                statusMessage.classList.remove('bg-teal-700');
                statusMessage.classList.add('bg-red-700');
                return;
            }

            const request = {
                location: location,
                radius: 10000, // بحث في نطاق 10 كم
                type: ['hospital', 'pharmacy'], // البحث عن مستشفيات وصيدليات
                rankBy: google.maps.places.RankBy.DISTANCE, // الترتيب حسب الأقرب
            };

            const service = new google.maps.places.PlacesService(map);
            
            service.nearbySearch(request, (results, status) => {
                // إزالة رسائل الخطأ القديمة
                statusMessage.classList.remove('bg-red-700', 'bg-teal-700', 'bg-indigo-700');
                
                if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                    
                    statusMessage.textContent = `تم العثور على ${results.length} مرفق طبي في منطقتك.`;
                    statusMessage.classList.add('bg-teal-700');

                    document.getElementById('hospital-results').classList.remove('hidden');

                    results.slice(0, 10).forEach((place, index) => { // عرض أول 10 نتائج فقط
                        const isHospital = place.types.includes('hospital');
                        const iconUrl = isHospital 
                            ? 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' // أحمر للمستشفيات
                            : 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'; // أزرق لأي مرفق آخر

                        // 1. إضافة علامة على الخريطة
                        const facilityMarker = new google.maps.Marker({
                            map: map,
                            position: place.geometry.location,
                            title: place.name,
                            label: (index + 1).toString(), // ترقيم العلامات
                            icon: iconUrl
                        });
                        hospitalMarkers.push(facilityMarker); 
                        
                        // إضافة نافذة معلومات
                        const infoWindow = new google.maps.InfoWindow({
                            content: `<div style="direction: rtl; font-family: 'Cairo', sans-serif; color: #1e293b;">
                                        <p class="font-bold">${place.name}</p>
                                        <p style="font-size: 0.9rem;">${place.vicinity || 'العنوان غير متوفر'}</p>
                                    </div>`
                        });

                        facilityMarker.addListener('click', () => {
                            infoWindow.open(map, facilityMarker);
                        });


                        // 2. إضافة إلى قائمة النتائج
                        const listItem = document.createElement('li');
                        listItem.className = 'p-3 bg-slate-700 rounded-lg shadow-md hover:bg-slate-600 transition duration-150 flex flex-col justify-start items-start';
                        
                        // عرض اسم المستشفى وعنوانها تحت الخريطة كما طلب المستخدم
                        listItem.innerHTML = `
                            <p class="text-xl font-bold ${isHospital ? 'text-red-400' : 'text-indigo-400'}">${index + 1}. ${place.name}</p>
                            <p class="text-gray-300 text-sm mt-1">العنوان: ${place.vicinity || 'العنوان غير متوفر'}</p>
                        `;
                        resultsList.appendChild(listItem);
                    });
                    
                } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    statusMessage.textContent = 'عفواً، لم يتم العثور على مرافق طبية قريبة ضمن نطاق 10 كم.';
                    statusMessage.classList.add('bg-red-700');
                    document.getElementById('hospital-results').classList.add('hidden');
                } else {
                    // رسالة الخطأ العامة
                    statusMessage.textContent = `
                        حدث خطأ في البحث عن الأماكن (Status: ${status}). 
                        تأكد من تفعيل خدمة Places API ومفتاح API في Google Cloud.
                    `;
                    statusMessage.classList.add('bg-red-700');
                    document.getElementById('hospital-results').classList.add('hidden');
                }
            });
        }

        function searchNearestHospital() {
            const searchButton = document.getElementById('search-hospital-button');
            const statusMessage = document.getElementById('status-message');
            
            if (!map) initializeMapPlaceholder(initialMapCenter); // التأكد من تهيئة الخريطة

            searchButton.textContent = '... جارٍ تحديد موقعك';
            searchButton.disabled = true;
            statusMessage.classList.remove('hidden', 'bg-red-700', 'bg-teal-700');
            statusMessage.classList.add('bg-indigo-700', 'text-white');
            statusMessage.textContent = '... الرجاء السماح بالوصول إلى الموقع الجغرافي';

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        const userLocation = { lat: lat, lng: lon };
                        
                        map.setCenter(userLocation);
                        map.setZoom(15);
                        
                        if (userMarker) { userMarker.setMap(null); }
                        userMarker = new google.maps.Marker({
                            position: userLocation,
                            map: map,
                            title: 'موقعك الحالي',
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillColor: '#EF4444', 
                                fillOpacity: 1,
                                strokeWeight: 2,
                                strokeColor: '#ffffff'
                            }
                        });

                        // بدء البحث عن المستشفيات
                        findNearbyHospitals(userLocation); 

                        // تحديث رسالة الحالة
                        statusMessage.textContent = 'تم تحديد موقعك بنجاح. يتم البحث عن المرافق الطبية القريبة.';
                        statusMessage.classList.remove('bg-indigo-700');
                        statusMessage.classList.add('bg-teal-700');
                        searchButton.textContent = 'إعادة البحث عن أقرب مستشفى';
                        searchButton.disabled = false;
                    },
                    (error) => {
                        let errorMessage = 'عذراً، حدث خطأ غير متوقع عند محاولة تحديد موقعك.';
                        if (error.code === error.PERMISSION_DENIED) {
                            errorMessage = 'الوصول إلى الموقع مرفوض. الرجاء السماح بالوصول إلى الموقع الجغرافي للمتصفح.';
                        } else if (error.code === error.POSITION_UNAVAILABLE) {
                            errorMessage = 'معلومات الموقع غير متاحة حالياً.';
                        } else if (error.code === error.TIMEOUT) {
                            errorMessage = 'انتهت مهلة طلب تحديد الموقع.';
                        }

                        statusMessage.classList.remove('bg-indigo-700', 'bg-teal-700');
                        statusMessage.classList.add('bg-red-700');
                        statusMessage.textContent = errorMessage;
                        searchButton.textContent = 'ابحث عن أقرب مستشفى';
                        searchButton.disabled = false;
                        console.error("Geolocation error:", errorMessage, error);
                    }
                );
            } else {
                statusMessage.classList.remove('bg-indigo-700');
                statusMessage.classList.add('bg-red-700');
                statusMessage.textContent = 'خطأ: متصفحك لا يدعم خاصية تحديد الموقع الجغرافي.';
                searchButton.textContent = 'ابحث عن أقرب مستشفى';
                searchButton.disabled = false;
            }
        }
        
        // **********************************************
        // منطق النموذج الصحي (الحفظ، PDF، QR)
        // **********************************************
        
        document.getElementById('health-form').addEventListener('submit', function(event) {
            event.preventDefault(); 
            const messageArea = document.getElementById('form-message');
            const actionContainer = document.getElementById('action-buttons-container');
            
            // 1. تخزين البيانات
            healthData = {
                name: document.getElementById('name').value,
                age: document.getElementById('age').value,
                blood_type: document.getElementById('blood_type').value,
                gender: document.getElementById('gender').value,
                height: document.getElementById('height').value,
                weight: document.getElementById('weight').value,
                conditions: document.getElementById('conditions').value,
                medications: document.getElementById('medications').value,
                emergency_contact: document.getElementById('emergency_contact').value,
            };

            // 2. عرض رسالة النجاح
            messageArea.textContent = `تم حفظ بياناتك بنجاح يا ${healthData.name}. يمكنك الآن تنزيلها أو إنشاء رمز QR.`;
            messageArea.classList.remove('hidden', 'bg-red-700');
            messageArea.classList.add('bg-teal-700', 'text-white');
            
            // 3. إظهار أزرار الإجراءات
            actionContainer.classList.remove('hidden');
        });


        // دالة تنزيل كملف PDF (باستخدام خاصية الطباعة)
        function generatePDF() {
            if (!healthData.name) {
                document.getElementById('form-message').textContent = 'الرجاء حفظ البيانات أولاً لإنشاء ملف PDF.';
                document.getElementById('form-message').classList.remove('hidden', 'bg-teal-700');
                document.getElementById('form-message').classList.add('bg-red-700', 'text-white');
                return;
            }

            // إنشاء محتوى الطباعة/PDF
            // تم تحديث اسم التطبيق هنا
            const printableContent = `
                <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 20px;" class="printable-content">
                    <h1 style="color: #008080; text-align: center; font-size: 24px; margin-bottom: 20px;">سجل معلومات الطوارئ - دكتور في جيبك</h1>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 16px; border: 1px solid #ccc;">
                        <tr><td style="border: 1px solid #ddd; padding: 10px; font-weight: bold; width: 30%;">الاسم الكامل:</td><td style="border: 1px solid #ddd; padding: 10px;">${healthData.name || '---'}</td></tr>
                        <tr><td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">فصيلة الدم:</td><td style="border: 1px solid #ddd; padding: 10px; background-color: #fce4e4;">${healthData.blood_type || '---'}</td></tr>
                        <tr><td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">العمر / النوع:</td><td style="border: 1px solid #ddd; padding: 10px;">${healthData.age || '---'} / ${healthData.gender || '---'}</td></tr>
                        <tr><td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">الطول / الوزن:</td><td style="border: 1px solid #ddd; padding: 10px;">${healthData.height ? healthData.height + ' سم' : '---'} / ${healthData.weight ? healthData.weight + ' كجم' : '---'}</td></tr>
                        <tr><td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">الحالات المزمنة:</td><td style="border: 1px solid #ddd; padding: 10px;">${healthData.conditions || 'لا توجد'}</td></tr>
                        <tr><td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">الأدوية الحالية:</td><td style="border: 1px solid #ddd; padding: 10px;">${healthData.medications || 'لا توجد'}</td></tr>
                        <tr><td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">جهة اتصال في الطوارئ:</td><td style="border: 1px solid #ddd; padding: 10px;">${healthData.emergency_contact || '---'}</td></tr>
                    </table>
                    <!-- تم تحديث اسم التطبيق هنا -->
                    <div style="margin-top: 40px; text-align: center; color: #777; font-size: 14px;">تم إنشاء هذا السجل بواسطة تطبيق دكتور في جيبك.</div>
                </div>
            `;

            // فتح نافذة طباعة جديدة
            const printWindow = window.open('', '_blank');
            printWindow.document.write('<html><head><title>سجل الطوارئ</title>');
            printWindow.document.write('<style>@import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap"); body { font-family: "Cairo", sans-serif; direction: rtl; }</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(printableContent);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            
            // استخدام تأخير بسيط لضمان عرض المحتوى قبل الطباعة
            setTimeout(() => {
                printWindow.print(); // يفتح مربع حوار الطباعة الذي يسمح بالحفظ كـ PDF
            }, 500);
        }

        // دالة عرض رمز QR (تم تبسيط البيانات لضمان العمل)
        function showQRCode() {
            if (!healthData.name) {
                document.getElementById('form-message').textContent = 'الرجاء حفظ البيانات أولاً لإنشاء رمز QR.';
                document.getElementById('form-message').classList.remove('hidden', 'bg-teal-700');
                document.getElementById('form-message').classList.add('bg-red-700', 'text-white');
                return;
            }

            // تجهيز البيانات بشكل مدمج لرمز QR (للطوارئ) - تنسيق نصي بسيط لضمان التوافق
            // تم التأكد من أن التنسيق بسيط وواضح لضمان قراءته في أغلب تطبيقات الـ QR
            const qrData = `Emergency Info | Name: ${healthData.name} | Blood: ${healthData.blood_type} | Conditions: ${healthData.conditions || 'None'} | Meds: ${healthData.medications || 'None'} | Contact: ${healthData.emergency_contact}`;

            const qrcodeDiv = document.getElementById('qrcode');
            qrcodeDiv.innerHTML = ''; // مسح الرمز السابق

            if (typeof QRCode !== 'undefined') {
                new QRCode(qrcodeDiv, {
                    text: qrData,
                    width: 200,
                    height: 200,
                    colorDark : "#1e293b",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
                document.getElementById('qr-modal').classList.remove('hidden');
            } else {
                document.getElementById('form-message').textContent = 'خطأ: مكتبة QR Code غير محملة. حاول تحديث الصفحة.';
                document.getElementById('form-message').classList.remove('hidden', 'bg-teal-700');
                document.getElementById('form-message').classList.add('bg-red-700', 'text-white');
            }
        }

        window.onload = () => {
             // تهيئة الخريطة الافتراضية
             if (typeof google !== 'undefined') {
                 initializeMapPlaceholder(initialMapCenter);
             }
        };