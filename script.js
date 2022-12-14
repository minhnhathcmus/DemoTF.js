console.log('Hello TensorFlow');
import {MnistData} from './data.js';

// Function to show the examples of the dataset
async function showExamples(data) {
  // Create a container in the visor
  const surface =
    tfvis.visor().surface({ name: 'Input Data Examples', tab: 'Input Data'});  

  // Get the examples
  const examples = data.nextTestBatch(20);
  const numExamples = examples.xs.shape[0];
  
  // Create a canvas element to render each example
  for (let i = 0; i < numExamples; i++) {
    const imageTensor = tf.tidy(() => {
      // Reshape the image to 28x28 px
      return examples.xs
        .slice([i, 0], [1, examples.xs.shape[1]])
        .reshape([28, 28, 1]);
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    canvas.style = 'margin: 4px;';
    await tf.browser.toPixels(imageTensor, canvas);
    surface.drawArea.appendChild(canvas);

    imageTensor.dispose();
  }
}

// Display the uploaded image
const imageLoader = document.getElementById('imageLoader');
imageLoader.addEventListener('change', (e) => {
    document.getElementById('image').src = URL.createObjectURL(e.target.files[0]);
});

// Function to run the training and evaluate process
async function run() {
  document.getElementById('train-status').innerHTML = 'Training...';
  const data = new MnistData();
  await data.load();
  await showExamples(data);
  
  const model = getModel();
  tfvis.show.modelSummary({name: 'Model Architecture', tab: 'Model'}, model);
  
  await train(model, data);

  await showAccuracy(model, data);
  await showConfusion(model, data);
  document.getElementById('train-status').innerHTML = 'Training Completed';
  await model.save('localstorage://trained-model');
  await model.save('downloads://trained-model');
}

// Function to take the uploaded image and make prediction on it
async function predict(model) {
    if (model == null) {
        model = await tf.loadGraphModel('SavedModel_to_TFjs/model.json');
        console.log('Use the default model - SavedModel_to_TFjs model');
    }
    // get the uploaded image
    const image = document.getElementById('image');
    // make the prediction
    const num_channels = 1;
    const max_pixel_value = tf.scalar(255);
    document.getElementById('predicted_result').innerHTML = 'Predicting...';
    const prediction = model.predict(tf.browser.fromPixels(image, num_channels).resizeNearestNeighbor([28, 28]).div(max_pixel_value).expandDims()).argMax(-1);
    // show the prediction to the predicted result element
    document.getElementById('predicted_result').innerHTML = 'This is the digit ' + classNames[prediction.dataSync()[0]];
}

// Load the chosen model
var model = null;
document.getElementById('model-selector').addEventListener('change', async () => {
    if (document.getElementById('model-selector').value == 'tf-SavedModel') {
      try {
        model = await tf.loadGraphModel('SavedModel_to_TFjs/model.json');
        console.log(model);
      } catch (e) {
        alert('No model found. Please train a model/download the pre-trained model first.');
        document.getElementById('model-selector').selectedIndex = 0;
      }
    }
    if (document.getElementById('model-selector').value == 'keras-h5') {
      try {
        model = await tf.loadLayersModel('keras_h5_to_TFjs/model.json');
        console.log(model);
      } catch (e) {
        alert('No model found. Please train a model/download the pre-trained model first.');
        document.getElementById('model-selector').selectedIndex = 0;
      }
    }
    if (document.getElementById('model-selector').value == 'tfjs-local-storage') {
      try {
        model = await tf.loadLayersModel('localstorage://trained-model');
        console.log(model);
      } catch (e) {
        alert('No model found in local storage. Please train the model first.');
        document.getElementById('model-selector').selectedIndex = 0;
      }
    }
});

document.getElementById('train').addEventListener('click', () => run());

// Take the uploaded image and make prediction when click the Predict button
document.getElementById('predict').addEventListener('click', () => predict(model));

function getModel() {
  const model = tf.sequential();
  
  const IMAGE_WIDTH = 28;
  const IMAGE_HEIGHT = 28;
  const IMAGE_CHANNELS = 1;  
  
  // In the first layer of our convolutional neural network we have 
  // to specify the input shape. Then we specify some parameters for 
  // the convolution operation that takes place in this layer.
  model.add(tf.layers.conv2d({
    inputShape: [IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS],
    kernelSize: 5,
    filters: 8,
    strides: 1,
    activation: 'relu',
    kernelInitializer: 'varianceScaling'
  }));

  // The MaxPooling layer acts as a sort of downsampling using max values
  // in a region instead of averaging.  
  model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));
  
  // Repeat another conv2d + maxPooling stack. 
  // Note that we have more filters in the convolution.
  model.add(tf.layers.conv2d({
    kernelSize: 5,
    filters: 16,
    strides: 1,
    activation: 'relu',
    kernelInitializer: 'varianceScaling'
  }));
  model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));
  
  // Now we flatten the output from the 2D filters into a 1D vector to prepare
  // it for input into our last layer. This is common practice when feeding
  // higher dimensional data to a final classification output layer.
  model.add(tf.layers.flatten());

  // Our last layer is a dense layer which has 10 output units, one for each
  // output class (i.e. 0, 1, 2, 3, 4, 5, 6, 7, 8, 9).
  const NUM_OUTPUT_CLASSES = 10;
  model.add(tf.layers.dense({
    units: NUM_OUTPUT_CLASSES,
    kernelInitializer: 'varianceScaling',
    activation: 'softmax'
  }));

  
  // Choose an optimizer, loss function and accuracy metric,
  // then compile and return the model
  const optimizer = tf.train.adam();
  model.compile({
    optimizer: optimizer,
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}

async function train(model, data) {
  const metrics = ['loss', 'val_loss', 'acc', 'val_acc'];
  const container = {
    name: 'Model Training', tab: 'Model', styles: { height: '1000px' }
  };
  const fitCallbacks = tfvis.show.fitCallbacks(container, metrics);
  
  const BATCH_SIZE = 512;
  const TRAIN_DATA_SIZE = 55000;
  const TEST_DATA_SIZE = 10000;

  const [trainXs, trainYs] = tf.tidy(() => {
    const d = data.nextTrainBatch(TRAIN_DATA_SIZE);
    return [
      d.xs.reshape([TRAIN_DATA_SIZE, 28, 28, 1]),
      d.labels
    ];
  });

  const [testXs, testYs] = tf.tidy(() => {
    const d = data.nextTestBatch(TEST_DATA_SIZE);
    return [
      d.xs.reshape([TEST_DATA_SIZE, 28, 28, 1]),
      d.labels
    ];
  });

  return model.fit(trainXs, trainYs, {
    batchSize: BATCH_SIZE,
    validationData: [testXs, testYs],
    epochs: 3,
    shuffle: true,
    callbacks: fitCallbacks
  });
}

const classNames = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

function doPrediction(model, data, testDataSize = 500) {
  const IMAGE_WIDTH = 28;
  const IMAGE_HEIGHT = 28;
  const testData = data.nextTestBatch(testDataSize);
  const testxs = testData.xs.reshape([testDataSize, IMAGE_WIDTH, IMAGE_HEIGHT, 1]);
  const labels = testData.labels.argMax(-1);
  const preds = model.predict(testxs).argMax(-1);

  testxs.dispose();
  return [preds, labels];
}
  
async function showAccuracy(model, data) {
  const [preds, labels] = doPrediction(model, data, 10000);
  const classAccuracy = await tfvis.metrics.perClassAccuracy(labels, preds);
  const container = {name: 'Accuracy', tab: 'Evaluation'};
  tfvis.show.perClassAccuracy(container, classAccuracy, classNames);

  labels.dispose();
}

async function showConfusion(model, data) {
  const [preds, labels] = doPrediction(model, data, 10000);
  const confusionMatrix = await tfvis.metrics.confusionMatrix(labels, preds);
  const container = {name: 'Confusion Matrix', tab: 'Evaluation'};
  tfvis.render.confusionMatrix(container, {values: confusionMatrix, tickLabels: classNames});

  labels.dispose();
}