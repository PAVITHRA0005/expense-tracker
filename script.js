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
