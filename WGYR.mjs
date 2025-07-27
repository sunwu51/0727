const API_URL1 = 'http://141.148.14.0:5000/api/up'; // 请根据实际情况修改
const API_URL2 = 'http://141.148.14.0:5000/api/down'; // 请根据实际情况修改
export async function calculate(input, up = true) {
    const response = await fetch(up ? API_URL1 :API_URL2, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input })
    });
    const {output, error} = await response.json();
    console.log(output);
    if (error) throw new Error(error);
    return [
        output.num1,
        output.num2,
        output.num3,
        output.num4,
    ]
}

  