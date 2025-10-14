// ----------------------------------------------------------
// 🖼 HERO BACKGROUND SLIDESHOW (your original code — unchanged)
// ----------------------------------------------------------
const images = [
  "https://images.unsplash.com/photo-1649972904349-9a3e6fcd508c",
  "https://images.unsplash.com/photo-1521540216272-a50305cd4421",
  "https://images.unsplash.com/photo-1565373678963-27a993b6f37b"
];

let i = 0;
const hero = document.querySelector(".hero");

setInterval(() => {
  hero.style.backgroundImage = `url(${images[i]})`;
  i = (i + 1) % images.length;
}, 6000); // change every 6 sec



// ----------------------------------------------------------
// 💰 EXPENSE TRACKER SECTION (added for backend connection)
// ----------------------------------------------------------

// HTML elements
const form = document.getElementById("expense-form");
const list = document.getElementById("expense-list");

// Load all expenses from backend
async function loadExpenses() {
  try {
    const res = await fetch("/api"); // connects to Vercel backend
    const data = await res.json();

    list.innerHTML = "";
    data.forEach(item => {
      const li = document.createElement("li");

      // Display each expense nicely
      li.innerHTML = `
        <span>${item.name}</span>
        <span class="amount">₹${item.amount}</span>
      `;
      list.appendChild(li);
    });
  } catch (error) {
    console.error("Error loading expenses:", error);
  }
}

// Handle adding a new expense
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const amount = document.getElementById("amount").value.trim();

    if (!name || !amount) return;

    const expense = { name, amount: parseFloat(amount) };

    try {
      await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expense)
      });

      form.reset();
      loadExpenses(); // Refresh after adding
    } catch (error) {
      console.error("Error adding expense:", error);
    }
  });

  // Load existing data when page opens
  loadExpenses();
}
