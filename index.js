const os = require('os-utils');
const EventEmitter = require('eventemitter3');

const EE = new EventEmitter();

const eventList = {};
const stats = {
  subscribers: {
    events: {},
  },
  callback: () => null,
};

const waitFor = (eventName, cb) => {
  eventList[eventName] = eventList[eventName] || [];
  eventList[eventName].push(eventName);
  const realCallback = (...args) => {
    cb(...args);
  }
  EE.on(eventName, realCallback);
  stats.subscribers.events[eventName] = stats.subscribers.events[eventName] || 0;
  stats.subscribers.events[eventName] += 1;
  stats.callback({ action: 'SUBSCRIBER_ADDED', actionName: eventName }, true);
  return () => {
    EE.removeListener(eventName, realCallback);
    eventList[eventName].pop();
    stats.subscribers.events[eventName] -= 1;
    stats.callback({ action: 'SUBSCRIBER_REMOVED', actionName: eventName }, true);
  }
};
const trigger = (eventName, ...args) => {
  if (eventName.match(/.*\*$/m)) {
    const matching = eventName.replace('*', '');
    const eventSet = Object.keys(eventList).filter(key => key.indexOf(matching) > -1);
    eventSet.forEach(eachEvent => EE.emit(eachEvent, ...args))
    return;
  }
  if (!stats.subscribers.events[eventName]) {
    stats.callback({ action: 'PUBLISHER_CANCELLED', actionName: eventName, reason: 'NO_SUBSCRIBERS_AVAILABLE' });
    return;
  }
  stats.callback({ action: 'PUBLISHER_TRIGGERED', actionName: eventName });
  EE.emit(eventName, ...args);
}

const perc = v => (v * 100).toFixed(4) + ' %';
const uptime = v => new Date(v * 1000).toISOString().substr(11, 8);

const getCpuUsage = () => {
  return new Promise((resolve) => {
    os.cpuUsage((v) => {
      resolve(perc(v));
    });
  });
};
const getCpuFree = () => {
  return new Promise((resolve) => {
    os.cpuFree((v) => {
      resolve(perc(v));
    });
  });
}
const mbToGb = v => (v / 1000).toFixed(3) + ' GB';
const getParams = async (params) => {
  try {
    const [used, free] = await Promise.all([getCpuUsage(), getCpuFree()])
    const { actionName } = params || {};
    const addons = actionName ? { currentTrigger: actionName, calledSubscribers: stats.subscribers.events[actionName] } : {};
    const currentStatus = {
      ...addons,
      ...(params || {}),
      cpu: {
        free,
        used,
        freeMemory: mbToGb(os.freemem()),
        processUp: uptime(os.processUptime()),
        freeMemPerc: perc(os.freememPercentage()),
        totalAvailableMemory: mbToGb(os.totalmem()),
      },
      subscribers: Object.keys(stats.subscribers.events),
      events: Object.keys(stats.subscribers.events).length,
    };
    return currentStatus
  } catch (e) {
    return null;
  }
}

let timer;
const monitor = async (cb) => {
  if (typeof cb !== 'function') {
    return;
  }
  stats.callback = (params = {}, force) => {
    if (force) {
      setTimeout(() => {
        getParams(params).then(cb);
      });
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      getParams(params).then(cb);
    }, 100);
  };
  setTimeout(() => {
    getParams().then(cb);
  });
}
const statistics = async () => {
  try {
    return await getParams();
  } catch (e) {
    return {};
  }
}
module.exports = {
  waitFor,
  on: waitFor,
  subscribe: waitFor,
  trigger,
  emit: trigger,
  publish: trigger,
  monitor,
  statistics,
};
