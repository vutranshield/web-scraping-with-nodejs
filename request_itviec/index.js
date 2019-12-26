const request = require('requestretry').defaults({ fullResponse: false })
const cheerio = require('cheerio');
const ObjectsToCsv = require('objects-to-csv');

const baseUrl = 'https://itviec.com';
const url = `${baseUrl}/it-jobs/tester/ho-chi-minh-hcm`;
const sampleJob = {
    companyName: "Cybozu",
    jobTitle: "Senior Automation Engineer",
    jobUrl: "https://itviec.com/it-jobs/automation-engineer-cybozu-4104",
    timeFromPosted: "3 hours ago",
    longDescription: "somethings goes here"
};
let scrapeResults = [];

String.prototype.replaceAll = function (search, replacement) {
    let target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

async function getJobsWithHeader() {
    try {
        let htmlResult = await request.get(url);
        let $ = await cheerio.load(htmlResult);
        const totalJobs = parseInt($("#jobs > h1").text().trim().split(" ")[0]); // Sample: 51 automation jobs in Ho Chi Minh for you
        const jobsPerPage = 20;

        for (let page = 1; page <= Math.ceil(totalJobs / jobsPerPage); page++) {
            htmlResult = await request.get(`${url}?page=${page}`);
            $ = await cheerio.load(htmlResult);

            $(".job_content").each((index, element) => {
                const companyLink = $(element).find(".logo-wrapper").children().attr("href");
                const companyName = companyLink.split("/")[2];
                const jobSelector = $(element).find("h2.title");
                const jobTitle = jobSelector.text().replaceAll('\n', '');
                const jobUrl = jobSelector.children().attr("href");
                const timeFromPosted = $(element).find("span.distance-time").text().replaceAll('\n', '');
                const jobResult = { companyName, jobTitle, jobUrl, timeFromPosted };
                scrapeResults.push(jobResult);
            });
        }
        return scrapeResults;
    } catch (err) {
        console.error(err)
    }
};

async function getJobsWithDescription(jobsWithHeader) {
    return await Promise.all(jobsWithHeader.map(async job => {
        try {
            const htmlResult = await request.get(`${baseUrl}${job.jobUrl}`);
            const $ = await cheerio.load(htmlResult);
            $("div.header").remove();
            $("div.action-line-bottom").remove();
            $("div.space-bottom").remove();
            job.longDescription = $(".job-detail").text().replaceAll('\n', '');
            return job;
        } catch (error) {
            console.error(error);
        }
    }))
}

async function convertObjToCsv(data) {
    let fullDate = new Date();
    let dd = String(fullDate.getDate()).padStart(2, '0');
    let mm = String(fullDate.getMonth() + 1).padStart(2, '0');
    let yyyy = fullDate.getFullYear();
    let time = fullDate.getTime();
    let shortDate = `${dd}_${mm}_${yyyy}_${time}`;

    let csv = new ObjectsToCsv(data);
    await csv.toDisk(`./output_${shortDate}.csv`, { bom: true });
}

(async () => {
    const jobsWithHeader = await getJobsWithHeader();
    const jobsWithDescription = await getJobsWithDescription(jobsWithHeader);
    await convertObjToCsv(jobsWithDescription);
})();