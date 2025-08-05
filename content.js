let lastProcessedJobId = null;

// Function to extract job ID from the URL (checks query params and path)

function getJobIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const currentJobId = urlParams.get("currentJobId");
  if (currentJobId) {
    return currentJobId;
  }

  // Fallback for /jobs/view/ style URLs
  const path = window.location.pathname;
  const regexView = /^\/jobs\/view\/(\d+)/;
  const matchView = path.match(regexView);
  if (matchView && matchView[1]) {
    return matchView[1];
  }

  // Handle /jobs/view/ID-slug/
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

// Function to find the active job ID from DOM elements
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

function getCsrfToken() {
  const cookies = document.cookie.split("; ");
  const jsessionidCookie = cookies.find((row) => row.startsWith("JSESSIONID="));

  if (jsessionidCookie) {
    // Example JSESSIONID="ajax:7370971078946560075"
    // We need the value inside the quotes, and it's directly the token.
    const match = jsessionidCookie.match(/JSESSIONID="([^"]+)"/);
    if (match && match[1]) {
      return match[1]; // This should be like "ajax:..."
    }
  }

  // Fallback: Sometimes it might be in a meta tag as 'csrfToken' or similar if LI changes it.
  // const csrfMeta = document.querySelector('meta[name="csrfToken"]'); // Example
  // if (csrfMeta && csrfMeta.content) {
  //   return csrfMeta.content;
  // }

  console.warn("Could not find CSRF token.");
  return null;
}

// Function to fetch applicant count from LinkedIn API
async function fetchApplicantCount(jobId) {
  // Use the FULL decorationId extracted from the successful request
  const decorationId =
    "com.linkedin.voyager.deco.jobs.web.shared.WebFullJobPosting-65&topN=1&topNRequestedFlavors=List(TOP_APPLICANT,IN_NETWORK,COMPANY_RECRUIT,SCHOOL_RECRUIT,HIDDEN_GEM,ACTIVELY_HIRING_COMPANY)";
  const apiUrl = `https://www.linkedin.com/voyager/api/jobs/jobPostings/${jobId}?decorationId=${decorationId}`;

  const csrfToken = getCsrfToken();
  if (!csrfToken) {
    console.error("Failed to get CSRF token. Cannot make API request.");
    return null;
  }

  // Define headers based on your network inspection
  const headers = {
    Accept: "application/vnd.linkedin.normalized+json+2.1", // Use the exact accept header you found
    "csrf-token": csrfToken, // Dynamically extracted CSRF token
    "x-li-track":
      '{"clientVersion":"1.13.37745","mpVersion":"1.13.37745","osName":"web","timezoneOffset":7,"timezone":"Asia/Saigon","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":2,"displayWidth":2732,"displayHeight":1536}', // Copy exact x-li-track
    "x-li-lang": "en_US", // Copy exact x-li-lang
    "x-li-page-instance":
      "urn:li:page:d_flagship3_job_details;9Vab80drRzOpwaPmMnEJ9A==", // Copy exact x-li-page-instance
    "x-restli-protocol-version": "2.0.0", // Copy exact x-restli-protocol-version
    "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"', // Copy exact
    "sec-ch-ua-mobile": "?0", // Copy exact
    "sec-ch-ua-platform": '"macOS"', // Copy exact
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", // Copy exact
    "accept-language": "vi-VN,vi;q=0.9", // Copy exact
    referer: window.location.href, // This should point to the current job page
    // 'priority': 'u=1, i', // No need for this
    // 'sec-fetch-dest': 'empty', // No need for this
    // 'sec-fetch-mode': 'cors', // No need for this
    // 'sec-fetch-site': 'same-origin', // No need for this
    // 'sec-gpc': '1', // No need for this
    // 'x-li-deco-include-micro-schema': 'true', // Not strictly a header for fetch, but part of context
    // 'x-li-pem-metadata': 'Voyager - Careers - Job Details=job-posting', // Not strictly a header for fetch
  };

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: headers,
      credentials: "include", // THIS IS IMPORTANT: Include cookies for authenticated requests
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
    console.log("Raw API response for Job ID", jobId, ":", data); // Keep for debugging

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

// Function to clean up any previously injected applicant count elements
function cleanupPreviousCounts() {
  const previousCounts = document.querySelectorAll(
    ".linkedin-exact-applicant-count"
  );
  previousCounts.forEach((el) => el.remove());
}

// Function to inject the count into the page
function injectApplicantCount(count) {
  // Always clean up before injecting a new one
  cleanupPreviousCounts(); // ADD THIS LINE

  let insightElement = document.querySelector(
    ".jobs-unified-top-card__job-insight"
  );
  const applicantsTextElement = insightElement
    ? insightElement.querySelector(
        ".jobs-unified-top-card__job-insight--multiple-applicants"
      )
    : null;

  if (applicantsTextElement) {
    // Replace the text of the existing "Over X applicants" element
    applicantsTextElement.textContent = `${count} applicants`;
    // Add a class for potential future styling specific to the replaced element
    applicantsTextElement.classList.add(
      "linkedin-exact-applicant-count-replaced"
    );
    console.log("Updated existing applicant count text.");
  } else if (insightElement) {
    // If the specific text element isn't found, but a general insight container is,
    // append our new element there.
    const countDisplay = document.createElement("span");
    countDisplay.className = "linkedin-exact-applicant-count"; // Use this for newly created spans
    countDisplay.style.fontWeight = "bold";
    countDisplay.style.color = "#1B9E76"; // LinkedIn blue
    countDisplay.style.marginLeft = "5px";
    countDisplay.textContent = ` (${count} applicants)`; // Show in parentheses for appending
    insightElement.appendChild(countDisplay);
    console.log("Injected new applicant count element.");
  } else {
    // Fallback: If no suitable insight element is found, try to inject near the job title.
    const jobTitleElement = document.querySelector(
      ".job-details-jobs-unified-top-card__job-title"
    );
    if (jobTitleElement) {
      const countDisplay = document.createElement("span");
      countDisplay.className = "linkedin-exact-applicant-count"; // Use this for newly created spans
      countDisplay.style.fontWeight = "bold";
      countDisplay.style.color = "#1B9E76";
      countDisplay.style.marginLeft = "10px";
      countDisplay.textContent = `(${count} applicants)`;
      jobTitleElement.parentElement.appendChild(countDisplay);
      console.log("Injected applicant count near job title as fallback.");
    } else {
      console.warn(
        "Could not find a suitable element to inject applicant count."
      );
    }
  }
}

// Function to process and fetch the applicant count
async function processJobPage(jobId) {
  // Add a check to prevent redundant processing if the ID hasn't actually changed
  if (jobId === lastProcessedJobId) {
    // console.log("Job ID is the same, skipping reprocessing."); // Uncomment for debugging
    return;
  }

  if (jobId) {
    lastProcessedJobId = jobId; // Update the last processed ID

    console.log("Processing LinkedIn Job ID:", jobId);
    cleanupPreviousCounts(); // Ensure old numbers are gone before new fetch

    const applicantCount = await fetchApplicantCount(jobId);
    if (applicantCount !== null) {
      console.log("Applicant Count:", applicantCount);
      injectApplicantCount(applicantCount);
    } else {
      console.log("Could not retrieve applicant count for Job ID:", jobId);
    }
  } else {
    // If no jobId is found, clear any displayed numbers (e.g., navigating away from a job details view)
    cleanupPreviousCounts();
    lastProcessedJobId = null; // Reset
    console.warn(
      "No Job ID found on this LinkedIn Jobs page. Clearing counts."
    );
  }
}

let observer; // MutationObserver instance

// Sets up the MutationObserver to watch for dynamic job content
function setupMutationObserver() {
  if (observer) observer.disconnect(); // Disconnect existing observer if any

  // The primary target for the observer will be a broader container
  // that encompasses both the job list and the details panel,
  // as the URL may change without a full page reload but content within this
  // container will mutate.
  // Common LinkedIn containers: #main, .scaffold-layout__main
  // Let's try .scaffold-layout__main first, as it's typically stable for content.
  const mainContentContainer = document.querySelector(".scaffold-layout__main");
  let targetNode = mainContentContainer || document.body; // Fallback to body

  let observerTargetName = mainContentContainer
    ? ".scaffold-layout__main"
    : "document.body (fallback)";

  const config = { childList: true, subtree: true, attributes: true };

  const callback = (mutationsList, observer) => {
    // On any mutation, re-evaluate the current job ID from both URL and DOM.
    // This catches both URL changes (via `getJobIdFromUrl`) and dynamic DOM loads.
    let currentJobId = getJobIdFromUrl();
    if (!currentJobId) {
      currentJobId = findActiveJobIdInDom();
    }

    // Now, call processJobPage. It contains its own logic to prevent redundant API calls
    // if the Job ID hasn't actually changed, or if it should cleanup.
    processJobPage(currentJobId);
  };

  observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
  console.log(
    `MutationObserver set up on ${observerTargetName} for comprehensive job page changes.`
  );
}

// Initial script execution logic
(function () {
  console.log("LinkedIn Applicant Count Extension content script loaded!");

  // Perform initial processing
  let initialJobId = getJobIdFromUrl();
  processJobPage(initialJobId); // Let processJobPage handle initial logic

  // Set up the observer for dynamic content updates and future navigations
  setupMutationObserver();
})();
