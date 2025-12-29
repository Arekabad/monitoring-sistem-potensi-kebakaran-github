// ===== KONFIGURASI GOOGLE SHEETS =====
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyTGhRuZcDDQv74ygmPsbo2YxLzu1CSrz--ATsahY76nJLo165t6aOGdkyKocEumIrCBA/exec";

// ===== KONFIGURASI PAGINATION & LIMIT =====
const CONFIG = {
    chartDataLimit: 10000,     // Maksimal titik data di grafik
    historyPageSize: 50,       // Data per halaman
    maxHistoryLoad: 10000,     // Maksimal data history yang di-load
    updateInterval: 5000,      // Interval update sensor (ms)
    historyInterval: 30000,    // Interval update history (ms)
    enableSampling: true,      // Toggle sampling on/off
    samplingThreshold: 2000    // Threshold untuk mulai sampling
};

// ===== MENU TOGGLE =====
document.getElementById("menuToggle")?.addEventListener("click", function () {
    const sidebar = document.querySelector(".sidebar");
    const main = document.querySelector(".main");
    const toggle = document.getElementById("menuToggle");
    const icon = toggle.querySelector("i");

    sidebar.classList.toggle("closed");
    main.classList.toggle("shifted");
    toggle.classList.toggle("shift");
    toggle.classList.toggle("active");

    if (sidebar.classList.contains("closed")) {
        icon.classList.replace("fa-bars", "fa-xmark");
    } else {
        icon.classList.replace("fa-xmark", "fa-bars");
    }
});

// ===== AMBANG BATAS =====
const BATAS = {
    suhu: 35,
    gas: 150,
    angin: 8
};

// ===== VARIABEL GLOBAL =====
let chartSuhu, chartGas, chartKelembaban, chartWindspeed, chartStatus;
let waktuData = [];
let suhuData = [];
let gasData = [];
let kelembabanData = [];
let anginData = [];
let statusData = [];

// Variabel untuk history dengan pagination
let allHistoryData = [];
let filteredHistoryData = [];
let currentPage = 1;

// ===== INISIALISASI FILTER TANGGAL =====
function initDateFilters() {
    // Filter untuk Grafik
    const chartFilterContainer = document.getElementById("chartFilterContainer");
    if (chartFilterContainer) {
        const today = new Date().toISOString().split('T')[0];
        chartFilterContainer.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <label style="font-weight: bold; color: #333;">
                    <i class="fas fa-calendar"></i> Filter Tanggal:
                </label>
                <input type="date" id="chartDateFrom" style="padding: 8px; border-radius: 5px; border: 1px solid #ddd; font-family: 'Poppins', sans-serif;">
                <span style="color: #666;">sampai</span>
                <input type="date" id="chartDateTo" style="padding: 8px; border-radius: 5px; border: 1px solid #ddd; font-family: 'Poppins', sans-serif;">
                <button id="chartFilterBtn" style="padding: 8px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 500; transition: 0.3s;">
                    <i class="fas fa-filter"></i> Terapkan Filter
                </button>
                <button id="chartResetBtn" style="padding: 8px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 500; transition: 0.3s;">
                    <i class="fas fa-redo"></i> Reset
                </button>
                <button id="chartShowAllBtn" style="padding: 8px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 500; transition: 0.3s;">
                    <i class="fas fa-expand"></i> Tampilkan Semua
                </button>
                <span id="chartDataCount" style="margin-left: 10px; color: #666; font-weight: 500;"></span>
            </div>
        `;

        document.getElementById("chartDateTo").value = today;
        
        document.getElementById("chartFilterBtn").addEventListener("click", () => {
            updateChartsFromHistory(true);
        });
        
        document.getElementById("chartResetBtn").addEventListener("click", () => {
            document.getElementById("chartDateFrom").value = "";
            document.getElementById("chartDateTo").value = today;
            updateChartsFromHistory(false);
        });
        
        document.getElementById("chartShowAllBtn").addEventListener("click", () => {
            document.getElementById("chartDateFrom").value = "";
            document.getElementById("chartDateTo").value = "";
            updateChartsFromHistory(true);
        });

        // Tambahkan hover effect
        ['chartFilterBtn', 'chartResetBtn', 'chartShowAllBtn'].forEach(id => {
            const btn = document.getElementById(id);
            btn.addEventListener('mouseenter', (e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            });
            btn.addEventListener('mouseleave', (e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
            });
        });
    }

    // Filter untuk History
    const historyFilterContainer = document.getElementById("historyFilterContainer");
    if (historyFilterContainer) {
        const today = new Date().toISOString().split('T')[0];
        historyFilterContainer.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <label style="font-weight: bold; color: #333;">
                    <i class="fas fa-calendar"></i> Filter Tanggal:
                </label>
                <input type="date" id="historyDateFrom" style="padding: 8px; border-radius: 5px; border: 1px solid #ddd; font-family: 'Poppins', sans-serif;">
                <span style="color: #666;">sampai</span>
                <input type="date" id="historyDateTo" style="padding: 8px; border-radius: 5px; border: 1px solid #ddd; font-family: 'Poppins', sans-serif;">
                <button id="historyFilterBtn" style="padding: 8px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 500;">
                    <i class="fas fa-filter"></i> Terapkan Filter
                </button>
                <button id="historyResetBtn" style="padding: 8px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 500;">
                    <i class="fas fa-redo"></i> Reset
                </button>
                <button id="historyExportBtn" style="padding: 8px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 500;">
                    <i class="fas fa-download"></i> Export CSV
                </button>
                <span id="historyDataCount" style="margin-left: 10px; color: #666; font-weight: 500;"></span>
            </div>
        `;

        document.getElementById("historyDateTo").value = today;
        
        document.getElementById("historyFilterBtn").addEventListener("click", () => {
            currentPage = 1;
            filterAndDisplayHistory();
        });
        
        document.getElementById("historyResetBtn").addEventListener("click", () => {
            document.getElementById("historyDateFrom").value = "";
            document.getElementById("historyDateTo").value = today;
            currentPage = 1;
            filterAndDisplayHistory();
        });
        
        document.getElementById("historyExportBtn").addEventListener("click", exportHistoryToCSV);
    }
}

// ===== INISIALISASI GRAFIK =====
function initCharts() {
    if (!document.getElementById("chartSuhu")) return;

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 400
        },
        scales: {
            x: {
                display: true,
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: true,
                    maxTicksLimit: 20
                }
            },
            y: { 
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return value.toFixed(1);
                    }
                }
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            tooltip: {
                mode: 'index',
                intersect: false
            }
        }
    };

    chartSuhu = new Chart(document.getElementById("chartSuhu").getContext("2d"), {
        type: "line",
        data: {
            labels: waktuData,
            datasets: [{
                label: "Suhu (°C)",
                data: suhuData,
                borderColor: "rgb(255, 99, 132)",
                backgroundColor: "rgba(255, 99, 132, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: true
            }]
        },
        options: commonOptions
    });

    chartGas = new Chart(document.getElementById("chartGas").getContext("2d"), {
        type: "line",
        data: {
            labels: waktuData,
            datasets: [{
                label: "Gas (ppm)",
                data: gasData,
                borderColor: "rgb(75, 192, 192)",
                backgroundColor: "rgba(75, 192, 192, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: true
            }]
        },
        options: commonOptions
    });

    chartKelembaban = new Chart(document.getElementById("chartKelembaban").getContext("2d"), {
        type: "line",
        data: {
            labels: waktuData,
            datasets: [{
                label: "Kelembaban (%)",
                data: kelembabanData,
                borderColor: "rgb(54, 162, 235)",
                backgroundColor: "rgba(54, 162, 235, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: true
            }]
        },
        options: { 
            ...commonOptions, 
            scales: { 
                ...commonOptions.scales,
                y: { beginAtZero: true, max: 100 } 
            } 
        }
    });

    chartWindspeed = new Chart(document.getElementById("chartWindspeed").getContext("2d"), {
        type: "line",
        data: {
            labels: waktuData,
            datasets: [{
                label: "Kecepatan Angin (m/s)",
                data: anginData,
                borderColor: "rgb(153, 102, 255)",
                backgroundColor: "rgba(153, 102, 255, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: true
            }]
        },
        options: commonOptions
    });

    // Grafik Status (Bar Chart)
    if (document.getElementById("chartStatus")) {
        chartStatus = new Chart(document.getElementById("chartStatus").getContext("2d"), {
            type: "bar",
            data: {
                labels: ["AMAN", "BAHAYA"],
                datasets: [{
                    label: "Jumlah Status",
                    data: [0, 0],
                    backgroundColor: [
                        "rgba(75, 192, 192, 0.6)",
                        "rgba(255, 99, 132, 0.6)"
                    ],
                    borderColor: [
                        "rgb(75, 192, 192)",
                        "rgb(255, 99, 132)"
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

// ===== UPDATE GRAFIK =====
function updateCharts() {
    if (!chartSuhu) return;

    chartSuhu.data.labels = waktuData;
    chartSuhu.data.datasets[0].data = suhuData;
    chartSuhu.update();

    chartGas.data.labels = waktuData;
    chartGas.data.datasets[0].data = gasData;
    chartGas.update();

    chartKelembaban.data.labels = waktuData;
    chartKelembaban.data.datasets[0].data = kelembabanData;
    chartKelembaban.update();

    chartWindspeed.data.labels = waktuData;
    chartWindspeed.data.datasets[0].data = anginData;
    chartWindspeed.update();

    // Update status chart
    if (chartStatus) {
        const amanCount = statusData.filter(s => s === "AMAN").length;
        const bahayaCount = statusData.filter(s => s === "BAHAYA" || s === "TIDAK AMAN").length;
        
        chartStatus.data.datasets[0].data = [amanCount, bahayaCount];
        chartStatus.update();
    }
}

// ===== AMBIL DATA SENSOR =====
async function loadSensorData() {
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getSensorData`);
        const data = await response.json();

        if (data.result === "Success") {
            const windSpeedMS = (data.angin / 3.6).toFixed(1);

            const suhuEl = document.getElementById("suhu");
            const kelembabanEl = document.getElementById("kelembaban");
            const anginEl = document.getElementById("angin");
            const arahEl = document.getElementById("arah");
            const derajatEl = document.getElementById("derajat");
            const gasEl = document.getElementById("gas");

            if (suhuEl) suhuEl.innerText = data.suhu.toFixed(1) + " °C";
            if (kelembabanEl) kelembabanEl.innerText = data.kelembaban.toFixed(0) + " %";
            if (anginEl) anginEl.innerText = windSpeedMS + " m/s";
            if (arahEl) arahEl.innerText = data.arah;
            if (derajatEl) derajatEl.innerText = data.derajat + "°";
            if (gasEl) gasEl.innerText = data.gas.toFixed(0) + " ppm";

            updateStatusDisplay(data, parseFloat(windSpeedMS));
        }
    } catch (error) {
        console.error("Gagal mengambil data:", error);
    }
}

// ===== UPDATE STATUS & KONDISI =====
function updateStatusDisplay(data, windSpeedMS) {
    const statusEl = document.getElementById("status");
    const kondisiEl = document.getElementById("kondisi");
    const buzzerEl = document.getElementById("buzzer");

    if (!statusEl || !kondisiEl || !buzzerEl) return;

    let bahaya = data.suhu > BATAS.suhu || data.gas > BATAS.gas || windSpeedMS > BATAS.angin;

    if (bahaya) {
        statusEl.innerText = "TIDAK AMAN";
        kondisiEl.innerText = "BAHAYA";
        buzzerEl.innerText = "ON";
        kondisiEl.style.color = "red";
        buzzerEl.style.color = "red";
        document.querySelector(".card.kondisi")?.classList.add("danger");
    } else {
        statusEl.innerText = data.status || "NORMAL";
        kondisiEl.innerText = "AMAN";
        buzzerEl.innerText = "OFF";
        kondisiEl.style.color = "green";
        buzzerEl.style.color = "green";
        document.querySelector(".card.kondisi")?.classList.remove("danger");
    }
}

// ===== UPDATE GRAFIK DARI DATA HISTORY =====
function updateChartsFromHistory(useFilter = false) {
    if (!chartSuhu) {
        console.warn("Chart belum diinisialisasi");
        return;
    }
    
    if (allHistoryData.length === 0) {
        console.warn("allHistoryData kosong");
        const countEl = document.getElementById("chartDataCount");
        if (countEl) {
            countEl.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #ffc107;"></i> Tidak ada data history`;
        }
        return;
    }

    showLoading();
    console.log("Memproses data untuk grafik:", allHistoryData.length, "items");

    try {
        let filteredData = [...allHistoryData];

        // Terapkan filter tanggal jika diminta
        if (useFilter) {
            const dateFrom = document.getElementById("chartDateFrom")?.value;
            const dateTo = document.getElementById("chartDateTo")?.value;

            filteredData = allHistoryData.filter(item => {
                const itemDate = parseTimestampToDate(item.timestamp);
                const fromMatch = !dateFrom || itemDate >= dateFrom;
                const toMatch = !dateTo || itemDate <= dateTo;
                return fromMatch && toMatch;
            });
            
            console.log("Filtered data:", filteredData.length, "items");
        }

        // Reset array data
        waktuData = [];
        suhuData = [];
        gasData = [];
        kelembabanData = [];
        anginData = [];
        statusData = [];

        // Limit data jika terlalu banyak
        let processedData = filteredData.slice(0, CONFIG.chartDataLimit);

        // Sampling jika perlu
        if (CONFIG.enableSampling && processedData.length > CONFIG.samplingThreshold && !useFilter) {
            processedData = sampleData(processedData, CONFIG.samplingThreshold);
            console.log(`Sampling aktif: ${filteredData.length} → ${processedData.length} data`);
        } else {
            console.log(`Menampilkan data: ${processedData.length} titik`);
        }

        // Populate data untuk grafik
        processedData.forEach((item, idx) => {
            // Debug item pertama
            if (idx === 0) {
                console.log("Sample data item:", item);
            }
            
            waktuData.push(formatWaktu(item.timestamp));
            suhuData.push(parseFloat(item.suhu) || 0);
            gasData.push(parseFloat(item.gas) || 0);
            kelembabanData.push(parseFloat(item.kelembaban) || 0);
            
            // Konversi angin dari km/h ke m/s
            const windMS = parseFloat(item.angin) / 3.6;
            anginData.push(parseFloat(windMS.toFixed(1)) || 0);
            
            // Tentukan status berdasarkan data
            const isBahaya = item.suhu > BATAS.suhu || item.gas > BATAS.gas || windMS > BATAS.angin;
            statusData.push(isBahaya ? "BAHAYA" : "AMAN");
        });

        console.log("Data arrays populated:");
        console.log("- waktuData:", waktuData.length);
        console.log("- suhuData:", suhuData.length);
        console.log("- gasData:", gasData.length);
        console.log("- Sample waktuData:", waktuData.slice(0, 3));
        console.log("- Sample suhuData:", suhuData.slice(0, 3));

        updateCharts();

        // Update info jumlah data
        const countEl = document.getElementById("chartDataCount");
        if (countEl) {
            if (processedData.length === filteredData.length) {
                countEl.innerHTML = `<i class="fas fa-check-circle" style="color: #28a745;"></i> Menampilkan <strong>${filteredData.length}</strong> data`;
            } else {
                countEl.innerHTML = `<i class="fas fa-info-circle" style="color: #ffc107;"></i> Menampilkan <strong>${processedData.length}</strong> dari <strong>${filteredData.length}</strong> data`;
            }
        }

    } catch (error) {
        console.error("Gagal update grafik:", error);
        const countEl = document.getElementById("chartDataCount");
        if (countEl) {
            countEl.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #dc3545;"></i> Gagal memuat data: ${error.message}`;
        }
    } finally {
        hideLoading();
    }
}

// ===== PARSE TIMESTAMP KE FORMAT TANGGAL =====
function parseTimestampToDate(timestamp) {
    // Input: "26/12/2024 14:30:45" atau "2024-12-26 14:30:45"
    // Output: "2024-12-26" untuk perbandingan
    try {
        const parts = timestamp.split(' ')[0];
        
        if (parts.includes('/')) {
            // Format: DD/MM/YYYY
            const [day, month, year] = parts.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else if (parts.includes('-')) {
            // Format: YYYY-MM-DD (sudah benar)
            return parts;
        }
        
        return parts;
    } catch (error) {
        console.error('Error parsing timestamp:', error);
        return '';
    }
}

// ===== FORMAT WAKTU =====
function formatWaktu(waktu) {
    try {
        if (!waktu) return "";
        
        if (typeof waktu === 'string') {
            const parts = waktu.split(' ');
            if (parts.length >= 2) {
                const datePart = parts[0];
                const timePart = parts[1];
                
                let shortDate = '';
                if (datePart.includes('/')) {
                    const dateSegments = datePart.split('/');
                    shortDate = `${dateSegments[0]}/${dateSegments[1]}`;
                } else if (datePart.includes('-')) {
                    const dateSegments = datePart.split('-');
                    shortDate = `${dateSegments[2]}/${dateSegments[1]}`;
                }
                
                const timeSegments = timePart.split(':');
                const shortTime = `${timeSegments[0]}:${timeSegments[1]}`;
                
                return `${shortDate} ${shortTime}`;
            }
        }
        
        return waktu;
    } catch (error) {
        console.error('Error formatting waktu:', error);
        return waktu;
    }
}

// ===== LOADING INDICATOR =====
function showLoading() {
    const countEl = document.getElementById("chartDataCount");
    if (countEl) {
        countEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Memuat data...`;
    }
}

function hideLoading() {
    // Loading sudah di-handle di updateChartsFromHistory
}

// ===== SAMPLING DATA (LTTB Algorithm - Simplified) =====
function sampleData(data, targetSize) {
    if (data.length <= targetSize) return data;

    const sampled = [data[0]];
    const bucketSize = (data.length - 2) / (targetSize - 2);

    for (let i = 1; i < targetSize - 1; i++) {
        const bucketStart = Math.floor((i - 1) * bucketSize) + 1;
        const bucketEnd = Math.floor(i * bucketSize) + 1;
        const bucketMid = Math.floor((bucketStart + bucketEnd) / 2);
        sampled.push(data[bucketMid]);
    }

    sampled.push(data[data.length - 1]);
    return sampled;
}

// ===== AMBIL HISTORY DATA =====
async function loadHistory() {
    try {
        showLoading();
        const url = `${GOOGLE_SCRIPT_URL}?action=getHistory&limit=${CONFIG.maxHistoryLoad}`;
        console.log("Mengambil data dari:", url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log("Response data:", data);
        console.log("Jumlah data diterima:", data.history?.length || 0);

        if (data.result === "Success" && data.history) {
            allHistoryData = data.history;
            console.log("allHistoryData loaded:", allHistoryData.length, "items");
            
            // Update grafik jika ada chart element
            if (document.getElementById("chartSuhu")) {
                console.log("Updating charts...");
                updateChartsFromHistory(false);
            }
            
            // Update history table jika ada
            if (document.getElementById("historyTableBody")) {
                console.log("Updating history table...");
                filterAndDisplayHistory();
            }
        } else {
            console.error("Data tidak valid atau kosong");
            allHistoryData = [];
        }
    } catch (error) {
        console.error("Gagal mengambil history:", error);
        allHistoryData = [];
    } finally {
        hideLoading();
    }
}

// ===== FILTER & TAMPILKAN HISTORY =====
function filterAndDisplayHistory() {
    const dateFrom = document.getElementById("historyDateFrom")?.value;
    const dateTo = document.getElementById("historyDateTo")?.value;

    filteredHistoryData = allHistoryData.filter(item => {
        const itemDate = parseTimestampToDate(item.timestamp);
        const fromMatch = !dateFrom || itemDate >= dateFrom;
        const toMatch = !dateTo || itemDate <= dateTo;
        return fromMatch && toMatch;
    });

    const countEl = document.getElementById("historyDataCount");
    if (countEl) {
        countEl.innerHTML = `<i class="fas fa-database"></i> Total: <strong>${filteredHistoryData.length}</strong> data`;
    }

    console.log("Filtered history data:", filteredHistoryData.length);
    renderHistoryPage();
}

// ===== RENDER HISTORY PAGE (DIPERBAIKI) =====
function renderHistoryPage() {
    const tableBody = document.getElementById("historyTableBody");
    if (!tableBody) return;

    const startIdx = (currentPage - 1) * CONFIG.historyPageSize;
    const endIdx = startIdx + CONFIG.historyPageSize;
    const pageData = filteredHistoryData.slice(startIdx, endIdx);

    const fragment = document.createDocumentFragment();

    if (pageData.length > 0) {
        pageData.forEach((item, index) => {
            const row = document.createElement("tr");
            const windMS = (item.angin / 3.6).toFixed(1);
            const statusClass = item.status === "BAHAYA" || item.status === "TIDAK AMAN" ? "danger" : "success";
            
            row.innerHTML = `
                <td style="text-align: center; font-weight: 500;">${startIdx + index + 1}</td>
                <td style="white-space: nowrap;">${item.timestamp}</td>
                <td style="text-align: center;">${parseFloat(item.suhu).toFixed(1)}°C</td>
                <td style="text-align: center;">${parseFloat(item.gas).toFixed(0)} ppm</td>
                <td style="text-align: center;">${windMS} m/s</td>
                <td style="text-align: center;">${item.kelembaban ? parseFloat(item.kelembaban).toFixed(0) + '%' : '-'}</td>
                <td style="text-align: center;"><span class="badge badge-${statusClass}">${item.status}</span></td>
            `;
            fragment.appendChild(row);
        });
    } else {
        const row = document.createElement("tr");
        row.innerHTML = "<td colspan='7' style='text-align: center; padding: 40px; color: #999;'><i class='fas fa-inbox' style='font-size: 48px; display: block; margin-bottom: 10px; opacity: 0.5;'></i><span style='font-size: 16px;'>Tidak ada data untuk ditampilkan</span></td>";
        fragment.appendChild(row);
    }

    tableBody.innerHTML = "";
    tableBody.appendChild(fragment);
    renderPagination();
}

// ===== HTML TABEL HISTORY YANG DIPERBAIKI =====
// Pastikan HTML tabel Anda memiliki struktur seperti ini:

/*
<div class="table-responsive">
    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 60px; text-align: center;">No</th>
                <th style="width: 180px;">Timestamp</th>
                <th style="width: 120px; text-align: center;">Suhu</th>
                <th style="width: 120px; text-align: center;">Gas</th>
                <th style="width: 120px; text-align: center;">Angin</th>
                <th style="width: 120px; text-align: center;">Kelembaban</th>
                <th style="width: 120px; text-align: center;">Status</th>
            </tr>
        </thead>
        <tbody id="historyTableBody">
            <!-- Data akan di-render di sini -->
        </tbody>
    </table>
</div>
<div id="historyPagination"></div>
*/

// ===== CSS TAMBAHAN UNTUK STYLING TABEL =====
// Tambahkan CSS ini ke file style.css Anda:

/*
.table-responsive {
    overflow-x: auto;
    margin-top: 20px;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    min-width: 800px;
}

.data-table thead {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.data-table thead th {
    padding: 15px 10px;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 13px;
    letter-spacing: 0.5px;
    border-bottom: 3px solid #5568d3;
}

.data-table tbody tr {
    border-bottom: 1px solid #eee;
    transition: all 0.3s ease;
}

.data-table tbody tr:hover {
    background-color: #f8f9ff;
    transform: scale(1.01);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.data-table tbody td {
    padding: 12px 10px;
    font-size: 14px;
    color: #333;
}

.badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 12px;
    display: inline-block;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.badge-success {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    color: white;
}

.badge-danger {
    background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
    color: white;
}

@media (max-width: 768px) {
    .data-table {
        font-size: 12px;
    }
    
    .data-table thead th,
    .data-table tbody td {
        padding: 10px 5px;
    }
}
*/

// ===== EXPORT CSV YANG DIPERBAIKI =====
function exportHistoryToCSV() {
    if (filteredHistoryData.length === 0) {
        alert("Tidak ada data untuk di-export");
        return;
    }

    // Header CSV dengan kolom terpisah
    let csv = "No,Timestamp,Suhu (°C),Gas (ppm),Angin (m/s),Kelembaban (%),Status\n";
    
    filteredHistoryData.forEach((item, index) => {
        const windMS = (item.angin / 3.6).toFixed(1);
        const kelembaban = item.kelembaban ? parseFloat(item.kelembaban).toFixed(0) : '-';
        csv += `${index + 1},"${item.timestamp}",${parseFloat(item.suhu).toFixed(1)},${parseFloat(item.gas).toFixed(0)},${windMS},${kelembaban},${item.status}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    const dateFrom = document.getElementById("historyDateFrom")?.value || 'all';
    const dateTo = document.getElementById("historyDateTo")?.value || 'data';
    a.download = `history_sensor_${dateFrom}_to_${dateTo}_${timestamp}.csv`;
    
    a.click();
    window.URL.revokeObjectURL(url);
    
    // Notifikasi sukses
    const countEl = document.getElementById("historyDataCount");
    if (countEl) {
        const originalHTML = countEl.innerHTML;
        countEl.innerHTML = `<i class="fas fa-check-circle" style="color: #28a745;"></i> Export berhasil! ${filteredHistoryData.length} data`;
        setTimeout(() => {
            countEl.innerHTML = originalHTML;
        }, 3000);
    }
}

// ===== RENDER PAGINATION =====
function renderPagination() {
    const paginationContainer = document.getElementById("historyPagination");
    if (!paginationContainer) return;

    const totalPages = Math.ceil(filteredHistoryData.length / CONFIG.historyPageSize);
    
    let html = '<div style="display: flex; gap: 5px; justify-content: center; margin-top: 20px; flex-wrap: wrap;">';
    
    html += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
             style="padding: 8px 12px; border: 1px solid #ddd; background: white; cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'}; border-radius: 4px; opacity: ${currentPage === 1 ? '0.5' : '1'};">
             <i class="fas fa-chevron-left"></i></button>`;
    
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button onclick="changePage(${i})" 
                 style="padding: 8px 12px; border: 1px solid #ddd; background: ${i === currentPage ? '#007bff' : 'white'}; 
                 color: ${i === currentPage ? 'white' : 'black'}; cursor: pointer; border-radius: 4px; font-weight: ${i === currentPage ? 'bold' : 'normal'};">
                 ${i}</button>`;
    }
    
    html += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
             style="padding: 8px 12px; border: 1px solid #ddd; background: white; cursor: ${currentPage === totalPages ? 'not-allowed' : 'pointer'}; border-radius: 4px; opacity: ${currentPage === totalPages ? '0.5' : '1'};">
             <i class="fas fa-chevron-right"></i></button>`;
    
    html += `<span style="padding: 8px 12px; color: #666;">Halaman ${currentPage} dari ${totalPages}</span></div>`;
    
    paginationContainer.innerHTML = html;
}

// ===== GANTI HALAMAN =====
function changePage(page) {
    const totalPages = Math.ceil(filteredHistoryData.length / CONFIG.historyPageSize);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderHistoryPage();
    
    // Scroll ke atas tabel
    document.getElementById("historyTableBody")?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== EXPORT TO CSV =====
function exportHistoryToCSV() {
    if (filteredHistoryData.length === 0) {
        alert("Tidak ada data untuk di-export");
        return;
    }

    let csv = "No,Timestamp,Suhu (°C),Gas (ppm),Angin (m/s),Kelembaban (%),Status\n";
    
    filteredHistoryData.forEach((item, index) => {
        csv += `${index + 1},${item.timestamp},${item.suhu},${item.gas},${(item.angin / 3.6).toFixed(1)},${item.kelembaban || '-'},${item.status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const dateFrom = document.getElementById("historyDateFrom")?.value || 'semua';
    const dateTo = document.getElementById("historyDateTo")?.value || 'data';
    a.download = `history_sensor_${dateFrom}_to_${dateTo}.csv`;
    
    a.click();
    window.URL.revokeObjectURL(url);
    
    // Notifikasi sukses
    const countEl = document.getElementById("historyDataCount");
    if (countEl) {
        const originalHTML = countEl.innerHTML;
        countEl.innerHTML = `<i class="fas fa-check-circle" style="color: #28a745;"></i> Export berhasil!`;
        setTimeout(() => {
            countEl.innerHTML = originalHTML;
        }, 3000);
    }
}

// Expose fungsi ke global scope
window.changePage = changePage;

// ===== INISIALISASI =====
window.addEventListener("load", () => {
    initDateFilters();
    initCharts();
    loadSensorData();
    loadHistory(); // Load history dulu untuk grafik

    // Auto-update sensor data
    setInterval(() => {
        loadSensorData();
    }, CONFIG.updateInterval);

    // Auto-update history (juga update grafik)
    setInterval(() => {
        const historyDateFrom = document.getElementById("historyDateFrom");
        const chartDateFrom = document.getElementById("chartDateFrom");
        
        // Update history jika tidak ada filter
        if (!historyDateFrom?.value && !document.getElementById("historyDateTo")?.value) {
            loadHistory();
        }
        
        // Update grafik jika tidak ada filter
        if (!chartDateFrom?.value && !document.getElementById("chartDateTo")?.value) {
            updateChartsFromHistory(false);
        }
    }, CONFIG.historyInterval);
});