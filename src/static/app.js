document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const adminToggle = document.getElementById("admin-toggle");
  const adminStatus = document.getElementById("admin-status");
  const loginForm = document.getElementById("login-form");

  let adminCredentials = sessionStorage.getItem("teacherCredentials");

  function authHeaders() {
    return adminCredentials
      ? { Authorization: `Basic ${adminCredentials}` }
      : {};
  }

  function updateAdminControls() {
    const isLoggedIn = Boolean(adminCredentials);
    adminStatus.classList.toggle("hidden", !isLoggedIn);
    adminToggle.textContent = isLoggedIn ? "Log out" : "Teacher login";
    loginForm.classList.toggle("hidden", isLoggedIn || loginForm.dataset.open !== "true");
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        adminCredentials
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">Remove</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    if (!adminCredentials) {
      showMessage("Teacher login is required to manage registrations.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  adminToggle.addEventListener("click", () => {
    if (adminCredentials) {
      adminCredentials = null;
      sessionStorage.removeItem("teacherCredentials");
      updateAdminControls();
      fetchActivities();
      showMessage("Logged out of teacher mode.", "info");
      return;
    }

    loginForm.dataset.open = "true";
    loginForm.classList.remove("hidden");
    document.getElementById("username").focus();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const credentials = btoa(`${username}:${password}`);

    try {
      const response = await fetch("/auth/verify", {
        headers: { Authorization: `Basic ${credentials}` },
      });

      if (!response.ok) {
        showMessage("Invalid teacher username or password.", "error");
        return;
      }

      adminCredentials = credentials;
      sessionStorage.setItem("teacherCredentials", credentials);
      loginForm.reset();
      loginForm.dataset.open = "false";
      updateAdminControls();
      fetchActivities();
      showMessage("Teacher mode enabled.", "success");
    } catch (error) {
      showMessage("Unable to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  async function verifySavedCredentials() {
    if (!adminCredentials) {
      updateAdminControls();
      return;
    }

    const response = await fetch("/auth/verify", { headers: authHeaders() });
    if (!response.ok) {
      adminCredentials = null;
      sessionStorage.removeItem("teacherCredentials");
    }
    updateAdminControls();
  }

  // Initialize app
  verifySavedCredentials();
  fetchActivities();
});
