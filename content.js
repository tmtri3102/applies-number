let lastProcessedJobId = null;

// Get job ID from URL (query or path)
function getJobIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const currentJobId = urlParams.get("currentJobId");
  if (currentJobId) {
    return currentJobId;
  }
  const path = window.location.pathname;
  const regexView = /^\/jobs\/view\/(\d+)/;
  const matchView = path.match(regexView);
  if (matchView && matchView[1]) {
    return matchView[1];
  }
  const viewIndex = path.indexOf("/view/");
  if (viewIndex !== -1) {
    const afterView = path.substring(viewIndex + "/view/".length);
    const idMatch = afterView.match(/^(\d+)/);
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }
  }
  return null;
}

// Get job ID from DOM if not in URL
function findActiveJobIdInDom() {
  const mainJobDetailsPanel = document.querySelector(
    ".jobs-search__job-details--wrapper"
  );
  if (mainJobDetailsPanel) {
    const applyButton = mainJobDetailsPanel.querySelector(".jobs-apply-button");
    if (applyButton && applyButton.dataset.jobId) {
      return applyButton.dataset.jobId;
    }
  }
  return null;
}

// Extract CSRF token from cookies
function getCsrfToken() {
  const cookies = document.cookie.split("; ");
  const jsessionidCookie = cookies.find((row) => row.startsWith("JSESSIONID="));
  if (jsessionidCookie) {
    const match = jsessionidCookie.match(/JSESSIONID="([^"]+)"/);
    if (match && match[1]) {
      return match[1];
    }
  }
  console.warn("Could not find CSRF token.");
  return null;
}

// Fetch applicant count from LinkedIn API
async function fetchApplicantCount(jobId) {
  const decorationId =
    "com.linkedin.voyager.deco.jobs.web.shared.WebFullJobPosting-65&topN=1&topNRequestedFlavors=List(TOP_APPLICANT,IN_NETWORK,COMPANY_RECRUIT,SCHOOL_RECRUIT,HIDDEN_GEM,ACTIVELY_HIRING_COMPANY)";
  const apiUrl = `https://www.linkedin.com/voyager/api/jobs/jobPostings/${jobId}?decorationId=${decorationId}`;
  const csrfToken = getCsrfToken();
  if (!csrfToken) {
    console.error("Failed to get CSRF token. Cannot make API request.");
    return null;
  }
  const headers = {
    Accept: "application/vnd.linkedin.normalized+json+2.1",
    "csrf-token": csrfToken,
    "x-li-track":
      '{"clientVersion":"1.13.37745","mpVersion":"1.13.37745","osName":"web","timezoneOffset":7,"timezone":"Asia/Saigon","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":2,"displayWidth":2732,"displayHeight":1536}',
    "x-li-lang": "en_US",
    "x-li-page-instance":
      "urn:li:page:d_flagship3_job_details;9Vab80drRzOpwaPmMnEJ9A==",
    "x-restli-protocol-version": "2.0.0",
    "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    "accept-language": "vi-VN,vi;q=0.9",
    referer: window.location.href,
  };
  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: headers,
      credentials: "include",
    });
    if (!response.ok) {
      console.error(
        `Error fetching applicant count for Job ID ${jobId}: HTTP status ${response.status} - ${response.statusText}`
      );
      try {
        const errorData = await response.json();
        console.error("API Error Details:", errorData);
      } catch (e) {
        console.error("API Error Body (text):", await response.text());
      }
      return null;
    }
    const data = await response.json();
    if (data && data.data && data.data.applies !== undefined) {
      return data.data.applies;
    } else {
      console.warn(
        "Applicant count 'applies' field not found in API response for Job ID:",
        jobId,
        data
      );
      return null;
    }
  } catch (error) {
    console.error(`Network or parsing error for Job ID ${jobId}:`, error);
    return null;
  }
}

// Remove previous applicant count elements
function cleanupPreviousCounts() {
  const previousCounts = document.querySelectorAll(
    ".linkedin-exact-applicant-count"
  );
  previousCounts.forEach((el) => el.remove());
}

// Inject applicant count into the page
function injectApplicantCount(count) {
  cleanupPreviousCounts();
  let insightElement = document.querySelector(
    ".jobs-unified-top-card__job-insight"
  );
  const applicantsTextElement = insightElement
    ? insightElement.querySelector(
        ".jobs-unified-top-card__job-insight--multiple-applicants"
      )
    : null;
  if (applicantsTextElement) {
    applicantsTextElement.textContent = `${count} applicants`;
    applicantsTextElement.classList.add(
      "linkedin-exact-applicant-count-replaced"
    );
  } else if (insightElement) {
    const countDisplay = document.createElement("span");
    countDisplay.className = "linkedin-exact-applicant-count";
    countDisplay.style.fontWeight = "bold";
    countDisplay.style.color = "#1B9E76";
    countDisplay.style.marginLeft = "5px";
    countDisplay.textContent = ` (${count} applicants)`;
    insightElement.appendChild(countDisplay);
  } else {
    const jobTitleElement = document.querySelector(
      ".job-details-jobs-unified-top-card__job-title"
    );
    if (jobTitleElement) {
      const countDisplay = document.createElement("span");
      countDisplay.className = "linkedin-exact-applicant-count";
      countDisplay.style.fontWeight = "bold";
      countDisplay.style.color = "#1B9E76";
      countDisplay.style.marginLeft = "10px";
      countDisplay.textContent = `(${count} applicants)`;
      jobTitleElement.parentElement.appendChild(countDisplay);
    } else {
      console.warn(
        "Could not find a suitable element to inject applicant count."
      );
    }
  }
}

// Main logic to process job page and show applicant count
async function processJobPage(jobId) {
  if (jobId === lastProcessedJobId) {
    return;
  }
  if (jobId) {
    lastProcessedJobId = jobId;
    cleanupPreviousCounts();
    const applicantCount = await fetchApplicantCount(jobId);
    if (applicantCount !== null) {
      injectApplicantCount(applicantCount);
    }
  } else {
    cleanupPreviousCounts();
    lastProcessedJobId = null;
    console.warn(
      "No Job ID found on this LinkedIn Jobs page. Clearing counts."
    );
  }
}

let observer;

// Watch for page changes to update applicant count
function setupMutationObserver() {
  if (observer) observer.disconnect();
  const mainContentContainer = document.querySelector(".scaffold-layout__main");
  let targetNode = mainContentContainer || document.body;
  const config = { childList: true, subtree: true, attributes: true };
  const callback = (mutationsList, observer) => {
    let currentJobId = getJobIdFromUrl();
    if (!currentJobId) {
      currentJobId = findActiveJobIdInDom();
    }
    processJobPage(currentJobId);
  };
  observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
}

// Initialize on page load
(function () {
  let initialJobId = getJobIdFromUrl();
  processJobPage(initialJobId);
  setupMutationObserver();
})();
