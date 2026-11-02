(function () {
  "use strict";

  const storage = {
    get: function (key, fallback) {
      try {
        const saved = localStorage.getItem(key);
        return saved === null ? fallback : JSON.parse(saved);
      } catch (error) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        // Keep the app usable when browser storage is unavailable.
      }
    }
  };

  const todayKey = function () {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  };

  const plants = storage.get("littleLeafPlants", PLANTS.map(function (plant) {
    return Object.assign({}, plant, { wateredOn: "" });
  }));
  const reminder = storage.get("littleLeafReminder", { time: "09:00", enabled: false });
  const plantList = document.getElementById("plant-list");
  const summary = document.getElementById("routine-summary");
  const emptyState = document.getElementById("empty-state");
  const reminderTime = document.getElementById("reminder-time");
  const reminderButton = document.getElementById("notification-toggle");
  const reminderStatus = document.getElementById("reminder-status");
  const dialog = document.getElementById("plant-dialog");
  const form = document.getElementById("plant-form");

  function savePlants() {
    storage.set("littleLeafPlants", plants);
  }

  function renderPlants() {
    const wateredCount = plants.filter(function (plant) {
      return plant.wateredOn === todayKey();
    }).length;
    const remaining = plants.length - wateredCount;

    summary.textContent = plants.length === 0
      ? "Your daily routine is ready when you are."
      : remaining === 0
        ? "All " + plants.length + " plants are watered. Lovely work."
        : remaining + " plant" + (remaining === 1 ? "" : "s") + " waiting for a drink today";

    emptyState.hidden = plants.length !== 0;
    plantList.replaceChildren();

    plants.forEach(function (plant, index) {
      const isWatered = plant.wateredOn === todayKey();
      const row = document.createElement("article");
      row.className = "plant-row";
      row.style.animationDelay = Math.min(index * 45, 180) + "ms";

      const avatar = document.createElement("span");
      avatar.className = "plant-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = plant.icon || "🪴";

      const info = document.createElement("div");
      info.className = "plant-info";
      const name = document.createElement("h3");
      name.textContent = plant.name;
      const detail = document.createElement("div");
      detail.className = "plant-detail";
      if (plant.species) {
        const species = document.createElement("span");
        species.textContent = plant.species;
        detail.append(species);
      }
      if (plant.location) {
        const location = document.createElement("span");
        location.textContent = plant.location;
        detail.append(location);
      }
      info.append(name, detail);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "water-button" + (isWatered ? " is-watered" : "");
      button.textContent = isWatered ? "✓ Watered" : "Mark watered";
      button.setAttribute("aria-label", isWatered ? plant.name + " watered today" : "Mark " + plant.name + " as watered");
      button.disabled = isWatered;
      button.addEventListener("click", function () {
        plant.wateredOn = todayKey();
        savePlants();
        renderPlants();
      });

      row.append(avatar, info, button);
      plantList.append(row);
    });
  }

  function saveReminder() {
    reminder.time = reminderTime.value || "09:00";
    storage.set("littleLeafReminder", reminder);
  }

  function updateReminderControls() {
    reminderButton.textContent = reminder.enabled ? "Turn off notifications" : "Turn on notifications";
    reminderButton.classList.toggle("is-enabled", reminder.enabled);
    reminderButton.setAttribute("aria-pressed", String(reminder.enabled));
    if (reminder.enabled) {
      reminderStatus.textContent = "Daily browser reminders are on for " + formatTime(reminder.time) + ". Keep Little Leaf open to receive them.";
    } else {
      reminderStatus.textContent = "Your daily plant list is ready whenever you are.";
    }
  }

  function formatTime(value) {
    const parts = value.split(":");
    const date = new Date();
    date.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function checkReminder() {
    if (!reminder.enabled || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const currentTime = new Date();
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const reminderParts = reminder.time.split(":");
    const reminderMinutes = Number(reminderParts[0]) * 60 + Number(reminderParts[1]);
    const duePlants = plants.filter(function (plant) { return plant.wateredOn !== todayKey(); });
    const sentKey = "littleLeafReminderSent";

    if (currentMinutes < reminderMinutes || duePlants.length === 0 || storage.get(sentKey, "") === todayKey()) {
      return;
    }

    const notification = new Notification("A little water, a lot of love", {
      body: duePlants.length + " plant" + (duePlants.length === 1 ? " is" : "s are") + " waiting for you today.",
      tag: "little-leaf-daily-reminder"
    });
    notification.onclick = function () {
      window.focus();
      notification.close();
    };
    storage.set(sentKey, todayKey());
  }

  document.getElementById("today-date").textContent = new Date().toLocaleDateString([], {
    weekday: "long", month: "long", day: "numeric"
  }).toUpperCase();

  reminderTime.value = reminder.time || "09:00";
  reminderTime.addEventListener("change", function () {
    saveReminder();
    updateReminderControls();
  });

  reminderButton.addEventListener("click", async function () {
    if (reminder.enabled) {
      reminder.enabled = false;
      saveReminder();
      updateReminderControls();
      return;
    }

    if (!("Notification" in window)) {
      reminderStatus.textContent = "This browser does not support notifications. Your daily plant list is still here.";
      return;
    }

    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;

    if (permission !== "granted") {
      reminderStatus.textContent = "Notifications are blocked. You can allow them in your browser settings.";
      return;
    }

    reminder.enabled = true;
    saveReminder();
    updateReminderControls();
    checkReminder();
  });

  document.getElementById("add-plant-open").addEventListener("click", function () {
    dialog.showModal();
    document.getElementById("plant-name").focus();
  });
  document.getElementById("add-first-plant").addEventListener("click", function () {
    dialog.showModal();
    document.getElementById("plant-name").focus();
  });
  document.getElementById("dialog-close").addEventListener("click", function () { dialog.close(); });
  document.getElementById("dialog-cancel").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const values = new FormData(form);
    const icons = ["🪴", "🌿", "🍃", "🌱", "🌵"];
    plants.push({
      id: "plant-" + Date.now(),
      name: values.get("name").trim(),
      species: values.get("species").trim(),
      location: values.get("location").trim(),
      icon: icons[plants.length % icons.length],
      wateredOn: ""
    });
    savePlants();
    renderPlants();
    form.reset();
    dialog.close();
  });

  renderPlants();
  updateReminderControls();
  checkReminder();
  window.setInterval(checkReminder, 30000);
})();