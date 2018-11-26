const { waitFor, trigger, monitor } = require('./');

monitor((status) => {
  console.log('Current Status', status);
})

const unsubscribe = waitFor('eventing', (data) => {
  console.log('Subscriber 1::', data);
});

const u = waitFor('eventing', (data) => {
  console.log('Subscriber 2::', data);
})

let counter = 0;
setInterval(() => {
  trigger('eventing', {
    id: ++counter,
  });
}, 3000);

setTimeout(unsubscribe, 10000);
setTimeout(u, 14000);
setTimeout(() => {
  const s = waitFor('eventing', (dat) => {
    console.log('New Subscriber 3::', dat)
  });
}, 15000)