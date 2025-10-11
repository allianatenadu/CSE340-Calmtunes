// Motivational Quotes Collection for Dashboard
// Steve Harvey and Jim Rohn Authentic Quotes

const motivationalQuotes = {
  steveHarvey: [
    {
      quote:
        "Do not ignore the passion that burns in you. Spend time to discover your gift.",
      author: "Steve Harvey",
      category: "passion",
    },
    {
      quote:
        "Your gift is the thing you do the absolute best with the least amount of effort.",
      author: "Steve Harvey",
      category: "talent",
    },
    {
      quote:
        "God lets you be successful because he trusts you that you will do the right thing with it.",
      author: "Steve Harvey",
      category: "success",
    },
    {
      quote: "You can't tell big dreams to small-minded people.",
      author: "Steve Harvey",
      category: "dreams",
    },
    {
      quote:
        "Failure is a great teacher, and I think when you make mistakes and you recover from them and you treat them as valuable learning experiences, then you've got something to share.",
      author: "Steve Harvey",
      category: "failure",
    },
    {
      quote: "The dream is free, but the hustle is sold separately.",
      author: "Steve Harvey",
      category: "hustle",
    },
    {
      quote:
        "You have to get comfortable being uncomfortable if you ever want to be successful.",
      author: "Steve Harvey",
      category: "growth",
    },
    {
      quote:
        "If you want to be successful, you have to jump, there's no way around it. When you jump, you develop wings on the way down.",
      author: "Steve Harvey",
      category: "courage",
    },
    {
      quote: "Men respect standards - get some!",
      author: "Steve Harvey",
      category: "standards",
    },
    {
      quote:
        "Your career is what you're paid for. Your calling is what you're made for.",
      author: "Steve Harvey",
      category: "purpose",
    },
  ],

  jimRohn: [
    {
      quote:
        "We must all suffer from one of two pains: the pain of discipline or the pain of regret. The difference is discipline weighs ounces while regret weighs tons.",
      author: "Jim Rohn",
      category: "discipline",
    },
    {
      quote:
        "You are the average of the five people you spend the most time with.",
      author: "Jim Rohn",
      category: "relationships",
    },
    {
      quote: "Success is not so much what we have as it is what we are.",
      author: "Jim Rohn",
      category: "success",
    },
    {
      quote:
        "If you really want to do something, you'll find a way. If you don't, you'll find an excuse.",
      author: "Jim Rohn",
      category: "determination",
    },
    {
      quote:
        "The greatest gift you can give somebody is your own personal development.",
      author: "Jim Rohn",
      category: "growth",
    },
    {
      quote: "Don't wish it were easier; wish you were better.",
      author: "Jim Rohn",
      category: "improvement",
    },
    {
      quote:
        "You must take personal responsibility. You cannot change the circumstances, the seasons, or the wind, but you can change yourself.",
      author: "Jim Rohn",
      category: "responsibility",
    },
    {
      quote:
        "Successful people do what unsuccessful people are not willing to do.",
      author: "Jim Rohn",
      category: "success",
    },
    {
      quote: "Work harder on yourself than you do on your job.",
      author: "Jim Rohn",
      category: "self-development",
    },
    {
      quote:
        "Learn to work harder on yourself than you do on your job. If you work hard on your job, you can make a living. If you work hard on yourself, you can make a fortune.",
      author: "Jim Rohn",
      category: "personal-development",
    },
    {
      quote:
        "Formal education will make you a living; self-education will make you a fortune.",
      author: "Jim Rohn",
      category: "education",
    },
    {
      quote: "Either you run the day or the day runs you.",
      author: "Jim Rohn",
      category: "time-management",
    },
  ],
};

// Dashboard Quote Display Functions

// Get a random quote from all quotes
function getRandomQuote() {
  const allQuotes = [
    ...motivationalQuotes.steveHarvey,
    ...motivationalQuotes.jimRohn,
  ];
  const randomIndex = Math.floor(Math.random() * allQuotes.length);
  return allQuotes[randomIndex];
}

// Get a random quote by author
function getQuoteByAuthor(author) {
  const authorKey = author.toLowerCase().replace(" ", "");
  if (authorKey === "steveharvey") {
    const quotes = motivationalQuotes.steveHarvey;
    return quotes[Math.floor(Math.random() * quotes.length)];
  } else if (authorKey === "jimrohn") {
    const quotes = motivationalQuotes.jimRohn;
    return quotes[Math.floor(Math.random() * quotes.length)];
  }
  return getRandomQuote();
}

// Get quote by category
function getQuoteByCategory(category) {
  const allQuotes = [
    ...motivationalQuotes.steveHarvey,
    ...motivationalQuotes.jimRohn,
  ];
  const categoryQuotes = allQuotes.filter((q) => q.category === category);
  if (categoryQuotes.length > 0) {
    return categoryQuotes[Math.floor(Math.random() * categoryQuotes.length)];
  }
  return getRandomQuote();
}

// Get daily quote (same quote for the whole day)
function getDailyQuote() {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24
  );
  const allQuotes = [
    ...motivationalQuotes.steveHarvey,
    ...motivationalQuotes.jimRohn,
  ];
  const quoteIndex = dayOfYear % allQuotes.length;
  return allQuotes[quoteIndex];
}

// HTML template for quote display
function createQuoteHTML(quoteObj) {
  // Determine author image URL
  let authorImage = "";
  let authorImageAlt = "";
  if (quoteObj.author === "Steve Harvey") {
    authorImage = "/images/Steve-Harvey.webp";
    authorImageAlt = "Steve Harvey";
  } else if (quoteObj.author === "Jim Rohn") {
    authorImage = "/images/Jim_rohn.jpg";
    authorImageAlt = "Jim Rohn";
  } else {
    // Fallback placeholder avatar
    authorImage =
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiM5OTk5OTkiLz4KPHN2ZyB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTIgMGM1LjUyMSAwIDEwIDQuNDc5IDEwIDEwdjE2YzAgNS41MjEtNC40NzkgMTAtMTAgMTBTMiAxNy41MjEgMiAxMlYxMEMyIDQuNDc5IDYuNDc5IDAgMTIgMFoiIGZpbGw9IiM4ODg4ODgiLz4KPC9zdmc+Cjwvc3ZnPgo=";
    authorImageAlt = "Author";
  }

  return `
    <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-xl shadow-lg mb-6">
      <div class="flex items-start space-x-4">
        <div class="flex-shrink-0">
          <img src="${authorImage}" alt="${authorImageAlt}" class="w-16 h-16 rounded-full object-cover border-2 border-white/20 shadow-md" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiM5OTk5OTkiLz4KPHN2ZyB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTIgMGM1LjUyMSAwIDEwIDQuNDc5IDEwIDEwdjE2YzAgNS41MjEtNC40NzkgMTAtMTAgMTBTMiAxNy41MjEgMiAxMlYxMEMyIDQuNDc5IDYuNDc5IDAgMTIgMFoiIGZpbGw9IiM4ODg4ODgiLz4KPC9zdmc+Cjwvc3ZnPgo=';">
        </div>
        <div class="flex-1">
          <div class="text-2xl text-blue-200 opacity-50 mb-4">
            <i class="fas fa-quote-left"></i>
          </div>
          <p class="text-lg md:text-xl font-medium leading-relaxed mb-4">
            "${quoteObj.quote}"
          </p>
          <div class="flex items-center justify-between">
            <p class="text-blue-100 font-semibold">
              — ${quoteObj.author}
            </p>
            <span class="bg-white/20 px-3 py-1 rounded-full text-sm capitalize">
              ${quoteObj.category.replace("-", " ")}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Dashboard integration functions - FIXED ALTERNATING LOGIC
function updateDashboardQuote() {
  const quoteContainer = document.getElementById("daily-quote-content");
  if (quoteContainer) {
    const lastAuthor = localStorage.getItem('lastQuoteAuthor');

    // FIXED: Proper alternating logic
    // If last was Steve Harvey, show Jim Rohn next
    // If last was Jim Rohn (or null/first time), show Steve Harvey next
    let authorQuotes;
    let nextAuthor;
    
    if (lastAuthor === 'steveharvey') {
      // Last was Steve, show Jim next
      authorQuotes = motivationalQuotes.jimRohn;
      nextAuthor = 'jimrohn';
    } else {
      // Last was Jim (or first time), show Steve next
      authorQuotes = motivationalQuotes.steveHarvey;
      nextAuthor = 'steveharvey';
    }

    const quote = authorQuotes[Math.floor(Math.random() * authorQuotes.length)];

    // Store the current author for next time
    localStorage.setItem('lastQuoteAuthor', nextAuthor);

    // Determine author image
    let authorImage = "";
    if (quote.author === "Steve Harvey") {
      authorImage = "/images/Steve-Harvey.webp";
    } else if (quote.author === "Jim Rohn") {
      authorImage = "/images/Jim_rohn.jpg";
    }

    // Update with simple text display and small author image
    quoteContainer.innerHTML = `
      <div class="flex items-start gap-3 mt-2">
        <img src="${authorImage}" alt="${quote.author}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="this.style.display='none'">
        <div class="flex-1">
          <p class="text-white/90 italic">"${quote.quote}"</p>
          <p class="text-white/70 text-sm mt-1">— ${quote.author}</p>
        </div>
      </div>
    `;
  }
}

// Initialize quote display
function initializeQuoteDisplay() {
  // Update quote on page load (this will start the alternating pattern)
  updateDashboardQuote();

  // Add refresh quote functionality for both button IDs
  const refreshBtn1 = document.getElementById("refresh-quote-btn");
  const refreshBtn2 = document.getElementById("refresh-quote");

  if (refreshBtn1) {
    refreshBtn1.addEventListener("click", () => {
      updateDashboardQuote();
    });
  }

  if (refreshBtn2) {
    refreshBtn2.addEventListener("click", () => {
      updateDashboardQuote();
    });
  }
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    motivationalQuotes,
    getRandomQuote,
    getQuoteByAuthor,
    getQuoteByCategory,
    getDailyQuote,
    createQuoteHTML,
    initializeQuoteDisplay,
  };
}

// Auto-initialize when DOM is ready (only once)
document.addEventListener("DOMContentLoaded", initializeQuoteDisplay);
