'use strict';

const express = require('express');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary');
const formData = require('express-form-data');
const moment = require('moment');

const User = require('../models/user');
const Media = require('../models/media');

const router = express.Router();

router.use(formData.parse());

const adminEmail = 'jewishbookcorner@gmail.com';

const dayNow = moment().calendar(null, {
  sameDay: 'MM/DD/YYYY',
  nextDay: 'MM/DD/YYYY',
  nextWeek: 'MM/DD/YYYY',
  lastDay: 'MM/DD/YYYY',
  lastWeek: 'MM/DD/YYYY',
  sameElse: 'MM/DD/YYYY'
});

const calculateBalance = overdueMedia => {
  let sum = 0;

  for (let media of overdueMedia) {
    let now = moment(dayNow, 'MM/DD/YYYY');
    let due = moment(media.dueDate, 'MM/DD/YYYY');
    //Difference in number of days
    let diff = moment.duration(now.diff(due)).asDays();
    sum += diff;
  }
  return sum;
};

/*GET all media in db - just image, title, availability, type - (all users)*/
router.get('/allMedia', (req, res, next) => {
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  return Media.find({}, { title: 1, img: 1, available: 1, type: 1, author: 1 })
    .then(allMedia => {
      res.json(allMedia);
    })
    .catch(err => {
      next(err);
    });
});

/*GET all checked out media (has a due date) (admin)*/
router.get('/allCheckedOutMedia', (req, res, next) => {
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  //make sure its admin
  return User.findOne({ email: adminEmail })
    .then(user => {
      if (user._id.toString() !== userId) {
        const err = new Error('Unauthorized');
        err.status = 400;
        throw err;
      } else {
        return Media.find({ available: false, dueDate: { $exists: true } })
          .populate('checkedOutBy')
          .populate('holdQueue');
      }
    })
    .then(allCheckedOutMedia => {
      res.json(allCheckedOutMedia);
    })
    .catch(err => {
      next(err);
    });
});

/*GET all requests (no due date) (admin)*/
router.get('/allRequests', (req, res, next) => {
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  //make sure its admin
  return User.findOne({ email: adminEmail })
    .then(user => {
      if (user._id.toString() !== userId) {
        const err = new Error('Unauthorized');
        err.status = 400;
        throw err;
      } else {
        return Media.find({ available: false, dueDate: { $exists: false } })
          .populate('checkedOutBy')
          .populate('holdQueue');
      }
    })
    .then(allCheckedOutMedia => {
      res.json(allCheckedOutMedia);
    })
    .catch(err => {
      next(err);
    });
});

/*GET all checked out media (specific to user)*/
router.get('/myCheckedOutMedia', (req, res, next) => {
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  return User.findById(userId)
    .populate({
      path: 'currentlyCheckedOut',
      select: { title: 1, img: 1, dueDate: 1, renewals: 1, type: 1, author: 1 }
    })
    .then(user => {
      let currentlyCheckedOut = user.currentlyCheckedOut;
      // console.log(currentlyCheckedOut);
      res.json(currentlyCheckedOut);
    })
    .catch(err => {
      next(err);
    });
});

/*GET all media on hold (specific to user)*/
router.get('/myMediaOnHold', (req, res, next) => {
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  return User.findById(userId)
    .populate({
      path: 'mediaOnHold',
      select: { title: 1, img: 1, type: 1, author: 1 }
    })
    .then(user => {
      let onHold = user.mediaOnHold || [];
      res.json(onHold);
    })
    .catch(err => {
      next(err);
    });
});

/*GET all overdue media (admin)*/
router.get('/allOverdueMedia', (req, res, next) => {
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  //make sure its admin
  return User.findOne({ email: adminEmail })
    .then(user => {
      if (user._id.toString() !== userId) {
        const err = new Error('Unauthorized');
        err.status = 400;
        throw err;
      } else {
        //find media who's due date is less than todays date
        return Media.find({ dueDate: { $lte: dayNow, $ne: '' } }).populate(
          'checkedOutBy'
        );
      }
    })
    .then(allOverDueMedia => {
      res.json(allOverDueMedia);
    })
    .catch(err => {
      next(err);
    });
});

/*GET all overdue media (specific to user)*/
router.get('/myOverdueMedia', (req, res, next) => {
  const userId = req.user.id;
  let overdueMedia;
  let balance;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  return User.findById(userId)
    .populate({
      path: 'currentlyCheckedOut',
      select: { title: 1, img: 1, dueDate: 1, type: 1, author: 1 },
      match: { dueDate: { $lte: dayNow, $ne: '' } }
    })
    .then(user => {
      overdueMedia = user.currentlyCheckedOut;
      balance = calculateBalance(overdueMedia);
      res.json({ overdueMedia, balance });
    })
    .catch(err => {
      next(err);
    });
});

/*GET checkout history (specific to user)*/
router.get('/myCheckoutHistory', (req, res, next) => {
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  return User.findById(userId)
    .populate({
      path: 'checkoutHistory',
      select: { title: 1, img: 1, type: 1, author: 1 }
    })
    .then(user => {
      let checkoutHistory = user.checkoutHistory;
      res.json(checkoutHistory);
    })
    .catch(err => {
      next(err);
    });
});

/*POST - create a new media (admin)*/
router.post('/', (req, res, next) => {
  const userId = req.user.id;
  const newMedia = req.body;
  // console.log('NEW MEDIA IS', newMedia);

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  //make sure its admin
  return User.findOne({ email: adminEmail })
    .then(user => {
      if (user._id.toString() !== userId) {
        const err = new Error('Unauthorized');
        err.status = 400;
        throw err;
      } else {
        newMedia.available = true;
        return Media.create(newMedia);
      }
    })
    .then(media => {
      res
        .location(`http://${req.headers.host}/media/${media.id}`)
        .status(201)
        .json(media);
    })

    .catch(err => {
      next(err);
    });
});

/*PUT - checking out media, or returning it (all users) */
router.put('/availability/:mediaId/:userId', (req, res, next) => {
  let { mediaId, userId } = req.params;
  let { available } = req.body; //booleans denoting if the book is now available, and if there's a holdQueue
  let media;
  let checkedOutBy;
  let promise;

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(mediaId)
  ) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  // We first need to check if the book is checked out by someone else (they can both click check out at same time if page isn't refreshed...)
  return Media.findById(mediaId)
    .then(media => {
      //dont do this if its being returned
      if (!media.available && !available) {
        const err = new Error(
          'Sorry, this book is already checked out by someone else. Please refresh your page to get the latest catalog!'
        );
        err.status = 400;
        return next(err);
      } else {
        return User.findById(userId);
      }
    })
    .then(user => {
      //if user is checking out media, need to update checkedOutBy and availability AFTER checking to make sure they haven't already checked out more than 2 types of media
      if (available === false) {
        if (user.currentlyCheckedOut.length === 2) {
          const err = new Error(
            'Cannot checkout more than 2 types of media at a time'
          );
          err.status = 400;
          throw err;
        } else {
          checkedOutBy = userId;
          promise = Media.findOneAndUpdate(
            { _id: mediaId },
            { available, checkedOutBy: checkedOutBy },
            { new: true }
          );
        }
      }
      //if media is being returned, change availability, and remove checkedOutBy and dueDate
      else {
        promise = Media.findOneAndUpdate(
          { _id: mediaId },
          { available, $unset: { checkedOutBy: 1, dueDate: 1, renewals: 1 } },
          { new: true }
        );
      }
      return promise;
    })
    .then(updatedMedia => {
      media = updatedMedia;

      //if checking out, add it to user's currentlyCheckedOut.
      if (!available) {
        return User.findOneAndUpdate(
          { _id: userId },
          { $push: { currentlyCheckedOut: mediaId } },
          { new: true }
        );
      }
      //if returning, remove it from user's currentlyCheckedOut and add it to checkoutHistory (if not already in there)
      else {
        // console.log('adding to checkout history');
        let removeFromCurrentlyCheckedOut = User.findOneAndUpdate(
          { _id: userId },
          { $pull: { currentlyCheckedOut: mediaId } },
          { new: true }
        );
        let addToCheckedOutHistory = User.findOneAndUpdate(
          { _id: userId },
          { $addToSet: { checkoutHistory: mediaId } },
          { new: true }
        );
        return Promise.all([
          removeFromCurrentlyCheckedOut,
          addToCheckedOutHistory
        ]);
      }
    })
    .then(() => {
      res.status(200).json(media);
    })
    .catch(err => {
      next(err);
    });
});

/*PUT - media ready for pickup: assign dueDate, clock starts ticking, handles holds (admin) */
router.put('/pickup/:mediaId', (req, res, next) => {
  const userId = req.user.id;
  const { mediaId } = req.params;
  const { holdQueue } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(mediaId)
  ) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  return User.findOne({ email: adminEmail })
    .then(user => {
      if (user._id.toString() !== userId) {
        const err = new Error('Unauthorized');
        err.status = 400;
        throw err;
      } else {
        let dueDate = moment()
          .add(14, 'days')
          .calendar(null, {
            sameDay: 'MM/DD/YYYY',
            nextDay: 'MM/DD/YYYY',
            nextWeek: 'MM/DD/YYYY',
            lastDay: 'MM/DD/YYYY',
            lastWeek: 'MM/DD/YYYY',
            sameElse: 'MM/DD/YYYY'
          });
        if (holdQueue) {
          let nextUser = holdQueue[0].id;
          //change checkedoutby to the first in the hold queue, change available to false, and pull that user out of hold queue
          let promise1 = Media.findOneAndUpdate(
            { _id: mediaId },
            {
              available: false,
              checkedOutBy: nextUser,
              $pull: { holdQueue: nextUser }
            },
            { new: true }
          );
          //add to users currently checked out and remove it from their mediaOnHold
          let promise2 = User.findOneAndUpdate(
            { _id: nextUser },
            {
              $push: { currentlyCheckedOut: mediaId },
              $pull: { mediaOnHold: mediaId }
            },
            { new: true }
          );
          return Promise.all([promise1, promise2]);
        } else {
          return Promise.all([
            Media.findOneAndUpdate(
              { _id: mediaId },
              { $set: { dueDate: dueDate, renewals: 0 } },
              { new: true }
            )
          ]);
        }
      }
    })
    .then(([media]) => {
      res.status(200).json(media);
    })
    .catch(err => {
      return next(err);
    });
});

/*PUT - put media on hold (all users) */
router.put('/hold/:mediaId/:action', (req, res, next) => {
  const userId = req.user.id;
  const { mediaId, action } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(mediaId)
  ) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  if (action === 'cancel') {
    //remove user from holdQueue, and remove media from the users mediaHold
    let promise1 = Media.findOneAndUpdate(
      { _id: mediaId },
      { $pull: { holdQueue: userId } },
      { new: true }
    );
    let promise2 = User.findOneAndUpdate(
      { _id: userId },
      { $pull: { mediaOnHold: mediaId } },
      { new: true }
    );
    return Promise.all([promise1, promise2])
      .then(([media]) => {
        res.status(200).json(media);
      })
      .catch(err => {
        return next(err);
      });
  } else {
    //make sure theyre not placing an item on hold thats available
    return Media.findById(mediaId)
      .then(media => {
        if (media.available) {
          const err = new Error('You cannot place a hold on available media');
          err.status = 400;
          throw err;
        }
        return User.findById(userId);
      })
      .then(user => {
        //if this was found, that means they already checked it out or already placed a hold
        if (
          user.currentlyCheckedOut.find(
            media => media.toString() === mediaId
          ) ||
          user.mediaOnHold.find(media => media.toString() === mediaId)
        ) {
          const err = new Error(
            'You cannot place a hold on media that you have currently checked out'
          );
          err.status = 400;
          throw err;
        }

        //add user to holdQueue, and add media to the users mediaHold
        let promise1 = Media.findOneAndUpdate(
          { _id: mediaId },
          { $push: { holdQueue: userId } },
          { new: true }
        );
        let promise2 = User.findOneAndUpdate(
          { _id: userId },
          { $push: { mediaOnHold: mediaId } },
          { new: true }
        );
        return Promise.all([promise1, promise2]);
      })
      .then(([media]) => {
        res.status(200).json(media);
      })
      .catch(err => {
        return next(err);
      });
  }
});

/*PUT - try to renew media (all users) */
router.put('/renew/:mediaId', (req, res, next) => {
  const userId = req.user.id;
  const { mediaId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(mediaId)
  ) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  return Media.findById(mediaId)
    .then(media => {
      if (media.available === true) {
        const err = new Error(
          'This media is not currently checked out and therefore cannot be renewed'
        );
        err.status = 400;
        throw err;
      }
      if (media.renewals === 1) {
        const err = new Error(
          'Media cannot be renewed, you have exceeded the renewal limit'
        );
        err.status = 400;
        throw err;
      } else if (media.checkedOutBy.toString() !== userId) {
        const err = new Error(
          'You do not have the authority to renew this media'
        );
        err.status = 400;
        throw err;
      } else {
        let dueDate = moment()
          .add(14, 'days')
          .calendar(null, {
            sameDay: 'MM/DD/YYYY',
            nextDay: 'MM/DD/YYYY',
            nextWeek: 'MM/DD/YYYY',
            lastDay: 'MM/DD/YYYY',
            lastWeek: 'MM/DD/YYYY',
            sameElse: 'MM/DD/YYYY'
          });
        return Media.findOneAndUpdate(
          { _id: mediaId },
          { dueDate: dueDate, renewals: 1 },
          { new: true }
        );
      }
    })
    .then(media => {
      res.status(200).json(media);
    })
    .catch(err => {
      return next(err);
    });
});

/*PUT - edit media (admin) */
router.put('/:mediaId', (req, res, next) => {
  const userId = req.user.id;
  const { mediaId } = req.params;
  const { title, type, author, img } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(mediaId)
  ) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  return User.findOne({ email: adminEmail })
    .then(user => {
      if (user._id.toString() !== userId) {
        const err = new Error('Unauthorized');
        err.status = 400;
        throw err;
      } else {
        return Media.findOneAndUpdate(
          { _id: mediaId },
          { title, type, author, img },
          { new: true }
        );
      }
    })
    .then(media => {
      res.status(200).json(media);
    })
    .catch(err => {
      return next(err);
    });
});

/*DELETE a media (admin)*/
router.delete('/:mediaId', (req, res, next) => {
  const userId = req.user.id;
  const mediaId = req.params.mediaId;

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(mediaId)
  ) {
    const err = new Error('The `id` is not a valid Mongoose id!');
    err.status = 400;
    return next(err);
  }

  return User.findOne({ email: adminEmail })
    .then(user => {
      if (user._id.toString() !== userId) {
        const err = new Error('Unauthorized');
        err.status = 400;
        throw err;
      } else {
        return Media.findById(mediaId);
      }
    })
    .then(media => {
      //only allow deletion of media if it's not checked out
      if (media.available) {
        return Media.findOneAndDelete({ _id: mediaId });
      } else {
        const err = new Error(
          'Cannot delete media, it is currently checked out'
        );
        err.status = 400;
        throw err;
      }
    })
    .then(media => {
      if (!media) {
        // if trying to delete something that no longer exists or never did
        return next();
      } else {
        res.sendStatus(204);
      }
    })
    .catch(err => {
      next(err);
    });
});

module.exports = router;

//be careful how I  use userId in the routes -- I might be  admin trying to reference user

//have to figure out balance, email, and texting

//no IDs should be seen in frontend

//To calculate balance:
//Go through list of overdue books for that user. Grab their due dates. Subtract dayNow- dueDate, and thats how many days late it is and how many dollars they owe.

//If the user is returning something that is overdue, show a red star for Sharon so she knows
