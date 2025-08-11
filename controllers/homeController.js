// Home controller for public pages
const homeController = {
  // GET /
  getHome: (req, res) => {
    res.render('pages/home', {
      title: 'Welcome to CalmTunes - Your Mental Health Companion'
    });
  },

  // GET /about
  getAbout: (req, res) => {
    res.render('pages/about', {
      title: 'About CalmTunes - Mental Health Support'
    });
  }
};

module.exports = homeController;