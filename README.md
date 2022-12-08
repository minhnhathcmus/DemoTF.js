# Repository chứa mã nguồn demo cho seminar TFLite & TF.js

1. Setup Python http server theo hướng dẫn này, chỉ cần làm xong mục Running a simple local http server https://developer.mozilla.org/en-US/docs/Learn/Common_questions/set_up_a_local_testing_server, những lần sau muốn chạy lại chỉ cần chạy lệnh python3 -m http.server

2. Chạy file index.html trong trình duyệt bằng cách truy cập vào đường dẫn sau: http://localhost:8000

3. Nhấn nút 'Click to train' để train model, sau khi train xong sẽ hiển thị đồ thị loss và accuracy của model và lưu model vào localStorage, những lần sau nếu không train lại thì sẽ load model này để dùng. Hoặc chọn model đã train trước đó bằng cách chọn trong mục 'Choose the model'.

4. Nhấn nút 'Choose file' để chọn ảnh từ máy tính, sau đó nhấn nút 'Predict' để dự đoán ảnh.