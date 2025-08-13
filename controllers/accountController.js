const authModel = require("../models/authModel");

const accountController = {
  // GET /account - Show account page
  getAccount: async (req, res) => {
    try {
      const userId = req.session.user.id;
      const user = await authModel.findUserById(userId);

      res.render("pages/account", {
        title: "My Account - CalmTunes",
        user: user
      });
    } catch (err) {
      console.error("Error loading account:", err);
      req.flash("error", "Unable to load account information.");
      res.redirect("/dashboard");
    }
  },

  // POST /account - Update account details
  postAccount: async (req, res) => {
    try {
      const userId = req.session.user.id;
      const { name, email, profile_image } = req.body; // profile_image for now will be a URL (upload later)

      await authModel.updateUser(userId, { name, email, profile_image });

      // Update session with new info
      req.session.user.name = name;
      req.session.user.email = email;

      req.flash("success", "Account updated successfully!");
      res.redirect("/account");
    } catch (err) {
      console.error("Error updating account:", err);
      req.flash("error", "Something went wrong while updating your account.");
      res.redirect("/account");
    }
  }
};

module.exports = accountController;
