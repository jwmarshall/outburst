if (Meteor.isClient) {

  var defaultRoomId = "default";

  function joinRoom(room_id) {
    userId = Meteor.userId();
    if (userId !== null) {
      Meteor.users.update({ _id: Meteor.userId() }, { $set: { room_id: room_id } });
    }
    Session.set("room_id", room_id);
  }

  Meteor.startup(function() {
    Hooks.init();
    if (Session.get("room_id") === undefined) {
      joinRoom(defaultRoomId);
    }
  });

  Hooks.onLoggedIn = function() {
    u = Meteor.user();
    if (u !== undefined) {
      console.log(Meteor.user());
      if (u.username === undefined) {
        $("#usernameModal").modal();
      }
      joinRoom(Session.get("room_id"));
    }
  }

  Meteor.subscribe("rooms");

  Meteor.autosubscribe(function() {
    Meteor.subscribe("messages", Session.get("room_id"));
    Meteor.subscribe("usersInRoom", Session.get("room_id"));
  });

  // Returns an event map that handles the "escape" and "return" keys and
  // "blur" events on a text input (given by selector) and interprets them
  // as "ok" or "cancel".
  var okCancelEvents = function (selector, callbacks) {
  var ok = callbacks.ok || function () {};
  var cancel = callbacks.cancel || function () {};

  var events = {};
  events['keyup '+selector+', keydown '+selector+', focusout '+selector] =
    function (evt) {
      if (evt.type === "keydown" && evt.which === 27) {
        // escape = cancel
        cancel.call(this, evt);

      } else if (evt.type === "keyup" && evt.which === 13) {
        // blur/return/enter = ok/submit if non-empty
        var value = String(evt.target.value || "");
        if (value)
          ok.call(this, value, evt);
        else
          cancel.call(this, evt);
      }
    };
    return events;
  };

  Template.usernameModal.events({
    'click #usernameModal .btn-primary': function(evt) {
      name = $('#usernameModal input').val();
      console.log(name);
      if (name !== '') {
        Meteor.users.update(
          { _id: Meteor.userId() },
          { $set: { username: name } },
          function(err) {
            if (err) {
              if (err.error == 409) {
                $('#usernameModal .alert').addClass('hide');
                $("#usernameModal #usernameTakenError").removeClass('hide');
                $("#usernameModal #usernameTakenError").addClass('fade in');
              }
            } else {
              $("#usernameModal").modal("hide");
              console.log("no error");
            }
        });
      } else {
        $('#usernameModal .alert').addClass('hide');
        $("#usernameModal #nullUsernameError").removeClass('hide');
        $("#usernameModal #nullUsernameError").addClass('fade in');
      }
    }
  });

  Template.roomList.rooms = function() {
    return Rooms.find();
  }

  Template.roomList.events({
    'click a.list-group-item': function(evt) {
      target = evt.currentTarget;
      room_id = target.id.substr(5);
      joinRoom(room_id);
      $('#roomList a.active').removeClass('active');
      $('#roomList #' + target.id).addClass('active');
    }
  });

  Template.roomList.helpers({
    isCurrentRoom: function(room_id) {
      return room_id === Session.get("room_id"); 
    }
  });

  Template.userList.users = function() {
    return Meteor.users.find({ room_id: Session.get('room_id') }, { sort: { _id: 1 } });
  }

  Template.chat.messages = function() {
    return Messages.find({ room_id: Session.get('room_id'), time: { $gt: Date.now() / 1000 } }, { sort: { time: 1 } });
  }

  Template.chat.room = function() {
    return Rooms.findOne({ _id: Session.get('room_id') });
  }

  Template.chat.rendered = function() {
    $("#messages").animate({ scrollTop: $("#messages")[0].scrollHeight }, 1000);
  };

  Template.reply.events(okCancelEvents(
    '#reply',
    {
      ok: function (text, event) {
        if (Meteor.userId() == null) {
          alert('you must login to chat');
        } else {
          var ts = Date.now() / 1000;
          Messages.insert({ username: Meteor.user().username, user_id: Meteor.userId(), room_id: Session.get('room_id'), msg: text, time: ts });
          event.target.value = "";
        }
      }
    }
  ));
}

if (Meteor.isServer) {

  Meteor.startup(function () {
    // code to run on server at startup
    if (Rooms.find().count() == 0) {
      rooms = [
        { _id: 'default', name: "Default Room", topic: 'Welcome to Outburst', active: 0 },
        { _id: 'support', name: "Support", topic: 'Support Chat', active: 0 },
        { _id: 'fishing', name: "Fishing", topic: 'Fishing Chat', active: 0 },
      ];
      _.each(rooms, function(room) {
        Rooms.insert(room); 
      });
    }
  });

  Meteor.publish("rooms", function() {
    return Rooms.find();
  });

  Meteor.publish("usersInRoom", function(room_id) {
    return Meteor.users.find({ room_id: room_id }, { sort: { _id: 1 }, fields: { room_id: 1 } });
  });

  Meteor.publish("messages", function(room_id) {
    return Messages.find({ room_id: room_id });
  });

  Meteor.users.allow({
    update: function(userId, doc, fields, modifier) {
      return doc._id === userId;
    }
  });

  Messages.allow({
    insert: function(userId, doc) {
      return userId !== null;
    }
  });

  Hooks.onLoggedOut = function(userId) {
    Meteor.users.update({ _id: userId }, { $set: { room_id: null } });  
  }

  Hooks.onCloseSession = function(userId) {
    if (userId !== null) {
      Meteor.users.update({ _id: userId }, { $set: { room_id: null } });
    }
  }

}
