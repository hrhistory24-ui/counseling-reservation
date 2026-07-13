import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  push,
  set,
  get,
  onValue,
  remove,
  update,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
const firebaseConfig = {
  apiKey: "AIzaSyBdoCaC3sVs6XNZ3YXhjrIUlQpE5sawRtk",
  authDomain: "counseling-site-4bcf6.firebaseapp.com",
  databaseURL:
    "https://counseling-site-4bcf6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "counseling-site-4bcf6",
  storageBucket: "counseling-site-4bcf6.firebasestorage.app",
  messagingSenderId: "184220475177",
  appId: "1:184220475177:web:c62b4146650ca6bd242138",
  measurementId: "G-976W2GZB4Y",
};

const ADMIN_UID = "LMVtg2fSEUQlJLRuNc10sEScBAo1";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const database = getDatabase(firebaseApp);

const loginSection = document.querySelector("#loginSection");
const dashboardSection = document.querySelector(
  "#dashboardSection",
);
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const logoutButton = document.querySelector("#logoutButton");

const reservationTableBody = document.querySelector(
  "#reservationTableBody",
);
const reservationCount = document.querySelector(
  "#reservationCount",
);
const reservationDateFilter = document.querySelector(
  "#reservationDateFilter",
);

const resetReservationFilterButton =
  document.querySelector(
    "#resetReservationFilterButton",
  );

const downloadCsvButton = document.querySelector(
  "#downloadCsvButton",
);

const toastMessage = document.querySelector("#toastMessage");
const scheduleForm = document.querySelector("#scheduleForm");
const scheduleDate = document.querySelector("#scheduleDate");

const startHour = document.querySelector("#startHour");
const startMinute = document.querySelector("#startMinute");
const endHour = document.querySelector("#endHour");
const endMinute = document.querySelector("#endMinute");

const saveScheduleButton = document.querySelector(
  "#saveScheduleButton",
);

const cancelScheduleEditButton = document.querySelector(
  "#cancelScheduleEditButton",
);

const scheduleTableBody = document.querySelector(
  "#scheduleTableBody",
);

const scheduleCount = document.querySelector(
  "#scheduleCount",
);

let consultationSchedules = {};
let publicReservations = {};

let editingScheduleId = null;
let scheduleListenerStarted = false;
let publicReservationListenerStarted = false;

function createTimeOptions() {
  const hours = [
    "09",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
  ];

  const minutes = [
    "00",
    "10",
    "20",
    "30",
    "40",
    "50",
  ];

  const hourOptions = hours
    .map(
      (hour) => `
        <option value="${hour}">${hour}</option>
      `,
    )
    .join("");

  const minuteOptions = minutes
    .map(
      (minute) => `
        <option value="${minute}">${minute}</option>
      `,
    )
    .join("");

  startHour.innerHTML = hourOptions;
  endHour.innerHTML = hourOptions;

  startMinute.innerHTML = minuteOptions;
  endMinute.innerHTML = minuteOptions;

  startHour.value = "09";
  startMinute.value = "00";
  endHour.value = "09";
  endMinute.value = "10";
}

function makeTime(hour, minute) {
  return `${hour}:${minute}`;
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);

  return hour * 60 + minute;
}

function formatScheduleDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  const [year, month, day] = dateValue.split("-");

  return `${year}.${month}.${day}`;
}

function listenToSchedules() {
  if (scheduleListenerStarted) {
    return;
  }

  scheduleListenerStarted = true;

  const schedulesRef = ref(
    database,
    "consultationSchedules",
  );

  onValue(
    schedulesRef,
    (snapshot) => {
      consultationSchedules = snapshot.val() || {};

      renderSchedules();
    },
    (error) => {
      console.error("상담 일정 불러오기 실패:", error);

      scheduleTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-cell">
            상담 일정을 불러오지 못했습니다.
          </td>
        </tr>
      `;

      showToast("상담 일정을 불러오지 못했습니다.");
    },
  );
}

function listenToPublicReservations() {
  if (publicReservationListenerStarted) {
    return;
  }

  publicReservationListenerStarted = true;

  const publicReservationsRef = ref(
    database,
    "publicReservations",
  );

  onValue(
    publicReservationsRef,
    (snapshot) => {
      publicReservations = snapshot.val() || {};
      renderSchedules();
    },
    (error) => {
      console.error(
        "공개 신청 현황 불러오기 실패:",
        error,
      );

      showToast(
        "상담 신청 현황을 불러오지 못했습니다.",
      );
    },
  );
}

function renderSchedules() {
  const scheduleEntries = Object.entries(
    consultationSchedules,
  ).sort(([, first], [, second]) => {
    const firstValue =
      `${first.date} ${first.startTime}`;

    const secondValue =
      `${second.date} ${second.startTime}`;

    return firstValue.localeCompare(secondValue);
  });

  scheduleCount.textContent =
    `총 ${scheduleEntries.length}개`;

  if (scheduleEntries.length === 0) {
    scheduleTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">
          등록된 상담 시간이 없습니다.
        </td>
      </tr>
    `;

    return;
  }

  scheduleTableBody.innerHTML = scheduleEntries
    .map(([slotId, schedule]) => {
      const reserved = Boolean(
        publicReservations[slotId],
      );

      return `
        <tr>
          <td>
            ${escapeHtml(
              formatScheduleDate(schedule.date),
            )}
          </td>

          <td>${escapeHtml(schedule.startTime)}</td>
          <td>${escapeHtml(schedule.endTime)}</td>

          <td>
            <span
              class="schedule-status ${
                reserved
                  ? "schedule-status-reserved"
                  : "schedule-status-open"
              }"
            >
              ${reserved ? "신청 있음" : "신청 가능"}
            </span>
          </td>

          <td>
            <div class="schedule-action-buttons">
              <button
                type="button"
                class="schedule-edit-button"
                data-schedule-id="${escapeHtml(slotId)}"
                ${reserved ? "disabled" : ""}
              >
                수정
              </button>

              <button
                type="button"
                class="schedule-delete-button"
                data-schedule-id="${escapeHtml(slotId)}"
                ${reserved ? "disabled" : ""}
              >
                삭제
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  attachScheduleEvents();
}

function attachScheduleEvents() {
  document
    .querySelectorAll(".schedule-edit-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const scheduleId =
          button.dataset.scheduleId;

        await startScheduleEdit(scheduleId);
      });
    });

  document
    .querySelectorAll(".schedule-delete-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const scheduleId =
          button.dataset.scheduleId;

        await deleteSchedule(scheduleId);
      });
    });
}

async function hasReservation(scheduleId) {
  const reservationSnapshot = await get(
    ref(
      database,
      `publicReservations/${scheduleId}`,
    ),
  );

  return reservationSnapshot.exists();
}

async function startScheduleEdit(scheduleId) {
  try {
    if (await hasReservation(scheduleId)) {
      showToast(
        "학생 신청이 있는 시간은 수정할 수 없습니다. 먼저 신청을 취소해 주세요.",
      );

      return;
    }

    const schedule =
      consultationSchedules[scheduleId];

    if (!schedule) {
      showToast("해당 상담 시간을 찾을 수 없습니다.");
      return;
    }

    editingScheduleId = scheduleId;

    scheduleDate.value = schedule.date;

    const [startHourValue, startMinuteValue] =
      schedule.startTime.split(":");

    const [endHourValue, endMinuteValue] =
      schedule.endTime.split(":");

    startHour.value = startHourValue;
    startMinute.value = startMinuteValue;
    endHour.value = endHourValue;
    endMinute.value = endMinuteValue;

    saveScheduleButton.textContent = "수정 내용 저장";
    cancelScheduleEditButton.hidden = false;

    scheduleDate.focus();
  } catch (error) {
    console.error("상담 일정 수정 준비 실패:", error);
    showToast("상담 일정을 수정할 수 없습니다.");
  }
}

async function deleteSchedule(scheduleId) {
  try {
    if (await hasReservation(scheduleId)) {
      showToast(
        "학생 신청이 있는 시간은 삭제할 수 없습니다. 먼저 신청을 취소해 주세요.",
      );

      return;
    }

    const confirmed = window.confirm(
      "이 상담 시간을 삭제하시겠습니까?",
    );

    if (!confirmed) {
      return;
    }

    await remove(
      ref(
        database,
        `consultationSchedules/${scheduleId}`,
      ),
    );

    showToast("상담 시간을 삭제했습니다.");

    if (editingScheduleId === scheduleId) {
      resetScheduleForm();
    }
  } catch (error) {
    console.error("상담 일정 삭제 실패:", error);
    showToast("상담 시간을 삭제하지 못했습니다.");
  }
}

scheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const date = scheduleDate.value;

  const startTime = makeTime(
    startHour.value,
    startMinute.value,
  );

  const endTime = makeTime(
    endHour.value,
    endMinute.value,
  );

  if (!date) {
    showToast("상담 날짜를 선택해 주세요.");
    return;
  }

  if (
    timeToMinutes(endTime) <=
    timeToMinutes(startTime)
  ) {
    showToast(
      "종료 시간은 시작 시간보다 늦어야 합니다.",
    );

    return;
  }

    const newStartMinutes = timeToMinutes(startTime);
    const newEndMinutes = timeToMinutes(endTime);

    const overlappingSchedule = Object.entries(
      consultationSchedules,
    ).some(([scheduleId, schedule]) => {
      if (scheduleId === editingScheduleId) {
        return false;
      }

      if (schedule.date !== date) {
        return false;
      }

      const existingStartMinutes = timeToMinutes(
        schedule.startTime,
      );

      const existingEndMinutes = timeToMinutes(
        schedule.endTime,
      );

      return (
        newStartMinutes < existingEndMinutes &&
        newEndMinutes > existingStartMinutes
      );
    });

    if (overlappingSchedule) {
      showToast(
        "같은 날짜에 이미 등록된 상담 시간과 겹칩니다.",
      );

      return;
    }

  saveScheduleButton.disabled = true;
  saveScheduleButton.textContent = "저장 중...";

  try {
    const scheduleData = {
      date,
      startTime,
      endTime,
      time: `${startTime}~${endTime}`,
      updatedAt: serverTimestamp(),
    };

    if (editingScheduleId) {
      await set(
        ref(
          database,
          `consultationSchedules/${editingScheduleId}`,
        ),
        scheduleData,
      );

      showToast("상담 시간을 수정했습니다.");
    } else {
      const newScheduleRef = push(
        ref(database, "consultationSchedules"),
      );

      await set(newScheduleRef, {
        ...scheduleData,
        createdAt: serverTimestamp(),
      });

      showToast("상담 시간을 추가했습니다.");
    }

    resetScheduleForm();
  } catch (error) {
    console.error("상담 일정 저장 실패:", error);
    showToast("상담 시간을 저장하지 못했습니다.");
  } finally {
    saveScheduleButton.disabled = false;

    if (!editingScheduleId) {
      saveScheduleButton.textContent =
        "상담 시간 추가";
    }
  }
});

function resetScheduleForm() {
  editingScheduleId = null;

  scheduleForm.reset();

  startHour.value = "09";
  startMinute.value = "00";
  endHour.value = "09";
  endMinute.value = "10";

  saveScheduleButton.textContent =
    "상담 시간 추가";

  cancelScheduleEditButton.hidden = true;
}

cancelScheduleEditButton.addEventListener(
  "click",
  resetScheduleForm,
);

let reservationListenerStarted = false;
let allReservationEntries = [];
let filteredReservationEntries = [];

function showToast(message) {
  toastMessage.textContent = message;
  toastMessage.classList.add("show");

  window.setTimeout(() => {
    toastMessage.classList.remove("show");
  }, 3500);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  const [year, month, day] = dateValue.split("-");

  return `${year}.${month}.${day}`;
}

function showLoginScreen() {
  loginSection.hidden = false;
  dashboardSection.hidden = true;
  logoutButton.hidden = true;

  reservationListenerStarted = false;
  scheduleListenerStarted = false;
  publicReservationListenerStarted = false;
}

function showDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  logoutButton.hidden = false;
}

function listenToPrivateReservations() {
  if (reservationListenerStarted) {
    return;
  }

  reservationListenerStarted = true;

  const privateReservationsRef = ref(
    database,
    "privateReservations",
  );

  onValue(
    privateReservationsRef,
    (snapshot) => {
      const reservations = snapshot.val() || {};

      allReservationEntries = Object.entries(
        reservations,
      ).sort(([, first], [, second]) => {
        const firstKey = `${first.date} ${first.time}`;
        const secondKey = `${second.date} ${second.time}`;

        return firstKey.localeCompare(secondKey);
      });

      updateReservationDateFilter();
      applyReservationFilter();
    },
    (error) => {
      console.error("신청 내역 불러오기 실패:", error);

      reservationTableBody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-cell">
            신청 내역을 불러오지 못했습니다.
          </td>
        </tr>
      `;

      showToast("신청 내역을 불러오지 못했습니다.");
    },
  );
}

function updateReservationDateFilter() {
  const currentValue = reservationDateFilter.value;

  const dates = [
    ...new Set(
      allReservationEntries
        .map(([, reservation]) => reservation.date)
        .filter(Boolean),
    ),
  ].sort();

  reservationDateFilter.innerHTML = `
    <option value="all">전체 날짜</option>
    ${dates
      .map(
        (date) => `
          <option value="${escapeHtml(date)}">
            ${escapeHtml(formatDate(date))}
          </option>
        `,
      )
      .join("")}
  `;

  if (
    currentValue === "all" ||
    dates.includes(currentValue)
  ) {
    reservationDateFilter.value = currentValue;
  } else {
    reservationDateFilter.value = "all";
  }
}

function applyReservationFilter() {
  const selectedDate = reservationDateFilter.value;

  if (selectedDate === "all") {
    filteredReservationEntries = [
      ...allReservationEntries,
    ];
  } else {
    filteredReservationEntries =
      allReservationEntries.filter(
        ([, reservation]) =>
          reservation.date === selectedDate,
      );
  }

  renderReservations(filteredReservationEntries);
}

reservationDateFilter.addEventListener(
  "change",
  applyReservationFilter,
);

resetReservationFilterButton.addEventListener(
  "click",
  () => {
    reservationDateFilter.value = "all";
    applyReservationFilter();
  },
);

function escapeCsvValue(value) {
  const text = String(value ?? "");

  return `"${text.replaceAll('"', '""')}"`;
}

function downloadReservationsCsv() {
  if (filteredReservationEntries.length === 0) {
    showToast("다운로드할 상담 신청이 없습니다.");
    return;
  }

  const headers = [
    "날짜",
    "시간",
    "학번",
    "이름",
    "상담 대상",
    "상담 방법",
    "상담 유형",
    "상담 희망 내용",
    "상태",
    "신청 일시",
  ];

  const rows = filteredReservationEntries.map(
    ([, reservation]) => {
      const status =
        reservation.status === "completed"
          ? "상담 완료"
          : "상담 예정";

      const createdAt = reservation.createdAt
        ? new Date(reservation.createdAt).toLocaleString(
            "ko-KR",
          )
        : "";

      return [
        reservation.date,
        reservation.time,
        reservation.studentNumber,
        reservation.studentName,
        reservation.consultationTarget,
        reservation.consultationMethod,
        reservation.consultationType,
        reservation.consultationNote || "",
        status,
        createdAt,
      ]
        .map(escapeCsvValue)
        .join(",");
    },
  );

  const csvContent = [
    headers.map(escapeCsvValue).join(","),
    ...rows,
  ].join("\n");

  /*
   * UTF-8 BOM을 추가하여
   * Excel에서 한글이 깨지는 것을 방지합니다.
   */
  const blob = new Blob(
    ["\uFEFF", csvContent],
    {
      type: "text/csv;charset=utf-8;",
    },
  );

  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const selectedDate = reservationDateFilter.value;

  const fileDate =
    selectedDate === "all"
      ? "전체"
      : selectedDate;

  link.href = downloadUrl;
  link.download =
    `상담신청목록_${fileDate}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(downloadUrl);

  showToast("CSV 파일을 다운로드했습니다.");
}

downloadCsvButton.addEventListener(
  "click",
  downloadReservationsCsv,
);

function renderReservations(reservationEntries) {
  reservationCount.textContent =
    `총 ${reservationEntries.length}건`;

  if (reservationEntries.length === 0) {
    reservationTableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-cell">
          등록된 상담 신청이 없습니다.
        </td>
      </tr>
    `;

    return;
  }

  reservationTableBody.innerHTML = reservationEntries
    .map(([slotKey, reservation]) => {
      const status = reservation.status || "waiting";

      const statusText =
        status === "completed" ? "상담 완료" : "상담 예정";

      const statusClass =
        status === "completed"
          ? "status-completed"
          : "status-waiting";

      return `
        <tr>
          <td>${escapeHtml(formatDate(reservation.date))}</td>
          <td>${escapeHtml(reservation.time)}</td>
          <td>${escapeHtml(reservation.studentNumber)}</td>
          <td>${escapeHtml(reservation.studentName)}</td>
          <td>${escapeHtml(reservation.consultationTarget)}</td>
          <td>${escapeHtml(reservation.consultationMethod)}</td>
          <td>${escapeHtml(reservation.consultationType)}</td>

          <td class="note-cell">
            ${escapeHtml(
              reservation.consultationNote ||
                "작성된 내용 없음",
            )}
          </td>

          <td>
            <span class="status-badge ${statusClass}">
              ${statusText}
            </span>
          </td>

          <td>
            <div class="action-buttons">
              <button
                type="button"
                class="complete-button"
                data-slot-key="${escapeHtml(slotKey)}"
                ${status === "completed" ? "disabled" : ""}
              >
                완료
              </button>

              <button
                type="button"
                class="cancel-reservation-button"
                data-slot-key="${escapeHtml(slotKey)}"
              >
                취소
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  attachActionEvents();
}

function attachActionEvents() {
  document
    .querySelectorAll(".complete-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const slotKey = button.dataset.slotKey;

        await completeReservation(slotKey);
      });
    });

  document
    .querySelectorAll(".cancel-reservation-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const slotKey = button.dataset.slotKey;

        await cancelReservation(slotKey);
      });
    });
}

async function completeReservation(slotKey) {
  const confirmed = window.confirm(
    "이 상담을 완료 상태로 변경하시겠습니까?",
  );

  if (!confirmed) {
    return;
  }

  try {
    await update(
      ref(
        database,
        `privateReservations/${slotKey}`,
      ),
      {
        status: "completed",
      },
    );

    showToast("상담 완료 상태로 변경했습니다.");
  } catch (error) {
    console.error("상담 완료 처리 실패:", error);
    showToast("상담 완료 처리에 실패했습니다.");
  }
}

async function cancelReservation(slotKey) {
  const confirmed = window.confirm(
    "이 상담 신청을 취소하시겠습니까?\n취소하면 해당 시간이 다시 신청 가능 상태가 됩니다.",
  );

  if (!confirmed) {
    return;
  }

  try {
    const updates = {};

    updates[`publicReservations/${slotKey}`] = null;
    updates[`privateReservations/${slotKey}`] = null;

    await update(ref(database), updates);

    showToast("상담 신청을 취소했습니다.");
  } catch (error) {
    console.error("상담 신청 취소 실패:", error);
    showToast("상담 신청 취소에 실패했습니다.");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document
    .querySelector("#adminEmail")
    .value.trim();

  const password = document.querySelector(
    "#adminPassword",
  ).value;

  const submitButton =
    loginForm.querySelector(".login-button");

  loginMessage.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "로그인 중...";

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );

    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);

      loginMessage.textContent =
        "관리자 권한이 없는 계정입니다.";

      return;
    }

    showDashboard();
    listenToSchedules();
    listenToPublicReservations();
    listenToPrivateReservations();
  } catch (error) {
    console.error("관리자 로그인 실패:", error);

    loginMessage.textContent =
      "이메일 또는 비밀번호를 확인해 주세요.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "로그인";
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showLoginScreen();
  } catch (error) {
    console.error("로그아웃 실패:", error);
    showToast("로그아웃에 실패했습니다.");
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLoginScreen();
    return;
  }

  if (user.uid !== ADMIN_UID) {
    await signOut(auth);
    showLoginScreen();
    return;
  }

  showDashboard();
  listenToSchedules();
  listenToPublicReservations();
  listenToPrivateReservations();
});

createTimeOptions();