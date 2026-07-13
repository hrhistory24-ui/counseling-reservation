import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

/* Firebase 프로젝트 설정 */
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

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

/* HTML 요소 */
const calendarTitle = document.querySelector("#calendarTitle");
const calendarGrid = document.querySelector("#calendarGrid");

const selectedDateTitle = document.querySelector(
  "#selectedDateTitle",
);

const selectedDateDescription = document.querySelector(
  "#selectedDateDescription",
);

const timeSlotList = document.querySelector("#timeSlotList");

const prevMonthButton = document.querySelector(
  "#prevMonthButton",
);

const nextMonthButton = document.querySelector(
  "#nextMonthButton",
);

const reservationModal = document.querySelector(
  "#reservationModal",
);

const modalCloseButton = document.querySelector(
  "#modalCloseButton",
);

const cancelButton = document.querySelector("#cancelButton");

const reservationForm = document.querySelector(
  "#reservationForm",
);

const modalDateText = document.querySelector("#modalDateText");
const modalTimeText = document.querySelector("#modalTimeText");
const toastMessage = document.querySelector("#toastMessage");

/* 현재 날짜를 초기 달력으로 설정 */
const today = new Date();

let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

/* Firebase에서 불러온 자료 */
let consultationSchedules = {};
let publicReservations = {};

/* 날짜별로 재정리한 상담 일정 */
let schedulesByDate = {};

/* 현재 선택 상태 */
let selectedDate = null;
let selectedScheduleId = null;

/* 실행 상태 */
let scheduleListenerStarted = false;
let reservationListenerStarted = false;
let initialMonthSet = false;

/* 날짜 키 만들기 */
function formatDateKey(year, month, day) {
  const formattedMonth = String(month + 1).padStart(2, "0");
  const formattedDay = String(day).padStart(2, "0");

  return `${year}-${formattedMonth}-${formattedDay}`;
}

/* 한국어 날짜 표시 */
function formatKoreanDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  const weekdayNames = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ];

  return `${year}년 ${month}월 ${day}일 ${
    weekdayNames[date.getDay()]
  }`;
}

/* Firebase 일정을 날짜별 구조로 재정리 */
function organizeSchedulesByDate() {
  schedulesByDate = {};

  Object.entries(consultationSchedules).forEach(
    ([scheduleId, schedule]) => {
      if (
        !schedule ||
        !schedule.date ||
        !schedule.startTime ||
        !schedule.endTime
      ) {
        return;
      }

      if (!schedulesByDate[schedule.date]) {
        schedulesByDate[schedule.date] = [];
      }

      schedulesByDate[schedule.date].push({
        id: scheduleId,
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        time:
          schedule.time ||
          `${schedule.startTime}~${schedule.endTime}`,
      });
    },
  );

  /* 같은 날짜 안에서는 시작 시간순 정렬 */
  Object.values(schedulesByDate).forEach((schedules) => {
    schedules.sort((first, second) =>
      first.startTime.localeCompare(second.startTime),
    );
  });
}

/* 처음 불러온 상담 일정이 있는 달로 이동 */
function setInitialCalendarMonth() {
  if (initialMonthSet) {
    return;
  }

  const scheduleDates = Object.keys(schedulesByDate).sort();

  if (scheduleDates.length === 0) {
    return;
  }

  const todayKey = formatDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const firstFutureDate =
    scheduleDates.find((dateKey) => dateKey >= todayKey) ||
    scheduleDates[0];

  const [year, month] = firstFutureDate.split("-").map(Number);

  currentYear = year;
  currentMonth = month - 1;
  initialMonthSet = true;
}

/* 상담 일정 실시간 불러오기 */
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

      organizeSchedulesByDate();
      setInitialCalendarMonth();

      /* 선택했던 날짜가 삭제된 경우 선택 해제 */
      if (
        selectedDate &&
        !schedulesByDate[selectedDate]
      ) {
        selectedDate = null;
        selectedScheduleId = null;
      }

      renderCalendar();
      renderTimeSlots();
    },
    (error) => {
      console.error("상담 일정 불러오기 실패:", error);

      showToast(
        "상담 일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    },
  );
}

/* 공개 신청 정보 실시간 불러오기 */
function listenToReservations() {
  if (reservationListenerStarted) {
    return;
  }

  reservationListenerStarted = true;

  const reservationsRef = ref(
    database,
    "publicReservations",
  );

  onValue(
    reservationsRef,
    (snapshot) => {
      publicReservations = snapshot.val() || {};

      renderCalendar();
      renderTimeSlots();
    },
    (error) => {
      console.error(
        "공개 신청 현황 불러오기 실패:",
        error,
      );

      showToast(
        "신청 현황을 불러오지 못했습니다.",
      );
    },
  );
}

/* 한 날짜에 신청 가능한 시간이 남아 있는지 확인 */
function hasAvailableSlot(dateKey) {
  const schedules = schedulesByDate[dateKey] || [];

  return schedules.some(
    (schedule) => !publicReservations[schedule.id],
  );
}

/* 달력 표시 */
function renderCalendar() {
  calendarGrid.innerHTML = "";

  calendarTitle.textContent =
    `${currentYear}년 ${currentMonth + 1}월`;

  const firstDay = new Date(
    currentYear,
    currentMonth,
    1,
  ).getDay();

  const lastDate = new Date(
    currentYear,
    currentMonth + 1,
    0,
  ).getDate();

  /* 첫째 날 이전 빈칸 */
  for (let index = 0; index < firstDay; index += 1) {
    const emptyCell = document.createElement("div");

    emptyCell.className = "calendar-day empty-day";

    calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const dateKey = formatDateKey(
      currentYear,
      currentMonth,
      day,
    );

    const dateObject = new Date(
      currentYear,
      currentMonth,
      day,
    );

    const weekday = dateObject.getDay();

    const button = document.createElement("button");

    button.type = "button";
    button.className = "calendar-day";

    if (weekday === 0) {
      button.classList.add("sunday-day");
    }

    if (weekday === 6) {
      button.classList.add("saturday-day");
    }

    button.innerHTML = `
      <span class="day-number">${day}</span>
    `;

    if (
      today.getFullYear() === currentYear &&
      today.getMonth() === currentMonth &&
      today.getDate() === day
    ) {
      button.classList.add("today");
    }

    const dateSchedules = schedulesByDate[dateKey];

    if (dateSchedules && dateSchedules.length > 0) {
      button.classList.add("available");

      if (!hasAvailableSlot(dateKey)) {
        button.classList.add("fully-reserved");
      }

      button.setAttribute(
        "aria-label",
        `${formatKoreanDate(dateKey)} 상담 일정 있음`,
      );

      button.addEventListener("click", () => {
        selectDate(dateKey);
      });
    } else {
      button.disabled = true;

      button.setAttribute(
        "aria-label",
        `${formatKoreanDate(dateKey)} 상담 일정 없음`,
      );
    }

    if (selectedDate === dateKey) {
      button.classList.add("selected");
    }

    calendarGrid.appendChild(button);
  }
}

/* 날짜 선택 */
function selectDate(dateKey) {
  selectedDate = dateKey;
  selectedScheduleId = null;

  renderCalendar();
  renderTimeSlots();
}

/* 시간대 목록 표시 */
function renderTimeSlots() {
  if (!selectedDate) {
    selectedDateTitle.textContent =
      "날짜를 선택해 주세요";

    selectedDateDescription.textContent =
      "달력에서 파란색으로 표시된 날짜를 선택하세요.";

    timeSlotList.innerHTML = `
      <div class="empty-message">
        상담 날짜를 선택하면 시간표가 나타납니다.
      </div>
    `;

    return;
  }

  const selectedSchedules =
    schedulesByDate[selectedDate] || [];

  selectedDateTitle.textContent =
    formatKoreanDate(selectedDate);

  selectedDateDescription.textContent =
    "원하는 상담 시간을 선택해 주세요.";

  if (selectedSchedules.length === 0) {
    timeSlotList.innerHTML = `
      <div class="empty-message">
        등록된 상담 시간이 없습니다.
      </div>
    `;

    return;
  }

  timeSlotList.innerHTML = "";

  selectedSchedules.forEach((schedule) => {
    const reservation =
      publicReservations[schedule.id];

    const reserved = Boolean(reservation);

    const slotElement = document.createElement("div");

    slotElement.className = "time-slot";

    if (reserved) {
      slotElement.classList.add("reserved");
    }

    const studentDisplay = reserved
      ? `
        <p class="reserved-student">
          ${escapeHtml(
            reservation.studentNumber || "",
          )}
          ${escapeHtml(
            reservation.studentName || "",
          )}
        </p>
      `
      : "";

    slotElement.innerHTML = `
      <div class="time-slot-info">
        <strong>
          ${escapeHtml(schedule.time)}
        </strong>

        <span>
          ${reserved ? "신청 완료" : "신청 가능"}
        </span>

        ${studentDisplay}
      </div>

      <button
        type="button"
        class="reserve-button"
        ${reserved ? "disabled" : ""}
      >
        ${reserved ? "마감" : "신청"}
      </button>
    `;

    const reserveButton =
      slotElement.querySelector(".reserve-button");

    if (!reserved) {
      reserveButton.addEventListener("click", () => {
        openReservationModal(schedule.id);
      });
    }

    timeSlotList.appendChild(slotElement);
  });
}

/* HTML 특수문자 안전 처리 */
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* 선택한 슬롯 찾기 */
function getSelectedSchedule() {
  return consultationSchedules[selectedScheduleId] || null;
}

/* 신청창 열기 */
function openReservationModal(scheduleId) {
  selectedScheduleId = scheduleId;

  const selectedSchedule = getSelectedSchedule();

  if (!selectedSchedule) {
    showToast(
      "해당 상담 시간을 찾을 수 없습니다.",
    );

    return;
  }

  if (publicReservations[scheduleId]) {
    showToast(
      "이미 다른 학생이 신청한 시간입니다.",
    );

    renderTimeSlots();
    return;
  }

  modalDateText.textContent =
    formatKoreanDate(selectedSchedule.date);

  modalTimeText.textContent =
    selectedSchedule.time ||
    `${selectedSchedule.startTime}~${selectedSchedule.endTime}`;

  reservationModal.classList.add("open");

  reservationModal.setAttribute(
    "aria-hidden",
    "false",
  );

  document.body.classList.add("modal-open");

  document.querySelector("#studentNumber").focus();
}

/* 신청창 닫기 */
function closeReservationModal() {
  reservationModal.classList.remove("open");

  reservationModal.setAttribute(
    "aria-hidden",
    "true",
  );

  document.body.classList.remove("modal-open");

  reservationForm.reset();
  selectedScheduleId = null;
}

/* 하단 안내 메시지 */
function showToast(message) {
  toastMessage.textContent = message;
  toastMessage.classList.add("show");

  window.setTimeout(() => {
    toastMessage.classList.remove("show");
  }, 3500);
}

/* 상담 신청 저장 */
reservationForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const studentNumber = document
      .querySelector("#studentNumber")
      .value.trim();

    const studentName = document
      .querySelector("#studentName")
      .value.trim();

    const consultationTarget = document
      .querySelector("#consultationTarget")
      .value;

    const consultationMethod = document
      .querySelector("#consultationMethod")
      .value;

    const consultationType = document
      .querySelector("#consultationType")
      .value;

    const consultationNote = document
      .querySelector("#consultationNote")
      .value.trim();

    if (
      !studentNumber ||
      !studentName ||
      !consultationTarget ||
      !consultationMethod ||
      !consultationType
    ) {
      showToast(
        "학번, 이름, 상담 대상, 상담 방법, 상담 유형을 모두 선택해 주세요.",
      );

      return;
    }

    if (!/^[0-9]{4,10}$/.test(studentNumber)) {
      showToast(
        "학번은 숫자로 정확하게 입력해 주세요.",
      );

      return;
    }

    if (!selectedScheduleId) {
      showToast(
        "상담 날짜와 시간을 다시 선택해 주세요.",
      );

      return;
    }

    const selectedSchedule = getSelectedSchedule();

    if (!selectedSchedule) {
      showToast(
        "선택한 상담 시간이 삭제되었거나 변경되었습니다.",
      );

      closeReservationModal();
      return;
    }

    const scheduleId = selectedScheduleId;

    const publicReservationRef = ref(
      database,
      `publicReservations/${scheduleId}`,
    );

    const privateReservationRef = ref(
      database,
      `privateReservations/${scheduleId}`,
    );

    const submitButton =
      reservationForm.querySelector(
        ".primary-button",
      );

    submitButton.disabled = true;
    submitButton.textContent = "신청 중...";

    try {
      /*
       * 공개 예약 경로를 트랜잭션으로 먼저 선점합니다.
       * 이미 값이 있으면 저장하지 않습니다.
       */
      const transactionResult = await runTransaction(
        publicReservationRef,
        (currentReservation) => {
          if (currentReservation !== null) {
            return;
          }

          return {
            scheduleId,
            date: selectedSchedule.date,
            startTime: selectedSchedule.startTime,
            endTime: selectedSchedule.endTime,
            time:
              selectedSchedule.time ||
              `${selectedSchedule.startTime}~${selectedSchedule.endTime}`,
            studentNumber,
            studentName,
            createdAt: serverTimestamp(),
          };
        },
      );

      if (!transactionResult.committed) {
        showToast(
          "방금 다른 학생이 먼저 신청했습니다. 다른 시간을 선택해 주세요.",
        );

        closeReservationModal();
        return;
      }

      /*
       * 비공개 상담 상세 정보 저장
       */
      await set(privateReservationRef, {
        scheduleId,
        date: selectedSchedule.date,
        startTime: selectedSchedule.startTime,
        endTime: selectedSchedule.endTime,
        time:
          selectedSchedule.time ||
          `${selectedSchedule.startTime}~${selectedSchedule.endTime}`,
        studentNumber,
        studentName,
        consultationTarget,
        consultationMethod,
        consultationType,
        consultationNote,
        status: "waiting",
        createdAt: serverTimestamp(),
      });

      closeReservationModal();

      showToast(
        `${studentName} 학생의 상담 신청이 완료되었습니다.`,
      );
    } catch (error) {
      console.error(
        "상담 신청 저장 실패:",
        error,
      );

      showToast(
        "신청 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "신청하기";
    }
  },
);

/* 이전 달 */
prevMonthButton.addEventListener("click", () => {
  currentMonth -= 1;

  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear -= 1;
  }

  selectedDate = null;
  selectedScheduleId = null;

  renderCalendar();
  renderTimeSlots();
});

/* 다음 달 */
nextMonthButton.addEventListener("click", () => {
  currentMonth += 1;

  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear += 1;
  }

  selectedDate = null;
  selectedScheduleId = null;

  renderCalendar();
  renderTimeSlots();
});

/* 팝업 닫기 */
modalCloseButton.addEventListener(
  "click",
  closeReservationModal,
);

cancelButton.addEventListener(
  "click",
  closeReservationModal,
);

document
  .querySelector("[data-close-modal]")
  .addEventListener(
    "click",
    closeReservationModal,
  );

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    reservationModal.classList.contains("open")
  ) {
    closeReservationModal();
  }
});

/* 앱 시작 */
async function startApp() {
  renderCalendar();
  renderTimeSlots();

  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.error("익명 로그인 실패:", error);

    showToast(
      "상담 신청 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}

/*
 * 인증 성공 후 Firebase 자료를 불러옵니다.
 */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    return;
  }

  console.log("익명 로그인 성공:", user.uid);

  listenToSchedules();
  listenToReservations();
});

startApp();