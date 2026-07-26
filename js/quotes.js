/*
  quotes.js — the "quote of the day".

  Two neat tricks here:

  1) The quotes are baked right into this file as a plain array. No API, no
     network request — which keeps FocusTab fully offline and instant.

  2) We want ONE quote that stays the same all day and changes tomorrow, without
     storing anything. We do that by turning today's date into a number (the
     day-of-year) and using the remainder operator (%) to land on an index that
     is always inside the array. Same day → same index → same quote.
*/

const Quotes = {
  list: [
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Well begun is half done.", author: "Aristotle" },
    { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
    { text: "Focus is a matter of deciding what things you're not going to do.", author: "John Carmack" },
    { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
    { text: "What we think, we become.", author: "Buddha" },
    { text: "The best way out is always through.", author: "Robert Frost" },
    { text: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
    { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
    { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
    { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
    { text: "Motivation gets you going, habit keeps you going.", author: "Jim Ryun" },
    { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { text: "Little by little, one travels far.", author: "J.R.R. Tolkien" },
    { text: "Discipline is choosing between what you want now and what you want most.", author: "Augusta F. Kantra" },
    { text: "Make each day your masterpiece.", author: "John Wooden" },
  ],

  init() {
    const quote = this.pickForToday(new Date());
    document.getElementById("quote-text").textContent = quote.text;
    document.getElementById("quote-author").textContent = quote.author;
  },

  // Choose a stable quote for the given date.
  pickForToday(date) {
    const index = this.dayOfYear(date) % this.list.length;
    return this.list[index];
  },

  // How many days into the year we are (Jan 1 = 1, Jan 2 = 2, ...).
  dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;             // difference in milliseconds
    const oneDay = 1000 * 60 * 60 * 24;    // ms in a day
    return Math.floor(diff / oneDay);
  },
};
